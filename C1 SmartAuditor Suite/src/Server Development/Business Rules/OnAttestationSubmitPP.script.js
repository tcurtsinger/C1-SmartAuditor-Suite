/**
 * Business Rule: SmartAttestation Review - Post Process
 * Table: asmt_assessment_instance
 * When: After Insert/Update
 * MUST BE ASYNC: Check the "Advanced" checkbox and select "Async" 
 * Condition: current.state.changes() && current.state == 'complete' // Adjust state value
 * Order: 200 (runs after validation rule)
 * Description: Performs async review after attestation is submitted
 * 
 * IMPORTANT: This rule MUST be set to Async in the Business Rule form
 * to allow outbound HTTP calls to the LLM API
 */

(function executeRule(current, previous /*null when async*/) {
    
    // Check if SmartAttestation Review is enabled
    var enableAutoReview = gs.getProperty('x_n1ll2_c1_smart_6.llm.enable_auto_review', 'true');
    if (enableAutoReview !== 'true') {
        gs.info('SmartAttestation Review: Auto-review is disabled');
        return;
    }
    
    // SIMPLIFIED CHECK: If sn_grc_item is populated, this is a GRC attestation
    if (!current.sn_grc_item) {
        // Not a GRC attestation, skip processing
        return;
    }
    
    gs.info('SmartAttestation Review: Processing GRC attestation ' + current.getUniqueValue() + ' for item: ' + current.sn_grc_item.getDisplayValue());
    
    // Check if already reviewed recently to avoid duplicates
    var recentReview = new GlideRecord('x_n1ll2_c1_smart_6_review_analysis');
    recentReview.addQuery('attestation', current.getUniqueValue());
    recentReview.orderByDesc('sys_created_on');
    recentReview.setLimit(1);
    recentReview.query();
    
    if (recentReview.next()) {
        var reviewTime = recentReview.getValue('sys_created_on');
        var oneMinuteAgo = new GlideDateTime();
        oneMinuteAgo.addSeconds(-60);
        
        if (reviewTime > oneMinuteAgo) {
            gs.info('SmartAttestation Review: Recent review exists, skipping duplicate processing');
            return;
        }
    }
    
    // Perform the review
    // NOTE: This only works if the Business Rule is set to Async
    try {
        var reviewer = new SmartAttestationReviewAPI();
        var result = reviewer.reviewAttestation(current.getUniqueValue());
        
        if (result.success) {
            gs.info('SmartAttestation Review: Successfully reviewed attestation ' + current.getUniqueValue());
            gs.info('  - Compliance Status: ' + result.analysis.compliance_status);
            gs.info('  - Risk Score: ' + result.analysis.risk_score);
            gs.info('  - Review Record: ' + result.reviewRecordId);
            
            // Add review summary to work notes
            var notes = 'SmartAttestation Review completed at ' + new GlideDateTime() + '\n';
            notes += 'Status: ' + result.analysis.compliance_status + '\n';
            notes += 'Risk Score: ' + result.analysis.risk_score + '/10\n';
            
            // If non-compliant, note it but don't change attestation state
            if (result.analysis.compliance_status === 'NON-COMPLIANT') {
                // Don't change attestation state - let it stay complete
                // The control will move to attest and generate a new attestation
                notes += '\nATTENTION: Attestation marked as NON-COMPLIANT.\n';
                notes += 'A new attestation will be generated for this control.\n';
                
                if (result.analysis.gaps && result.analysis.gaps.length > 0) {
                    notes += '\nGaps identified:\n';
                    result.analysis.gaps.forEach(function(gap) {
                        notes += '• ' + gap + '\n';
                    });
                }
                
                if (result.analysis.recommendations && result.analysis.recommendations.length > 0) {
                    notes += '\nRecommendations:\n';
                    result.analysis.recommendations.forEach(function(rec) {
                        notes += '• ' + rec + '\n';
                    });
                }
            }
            
            current.work_notes = notes;
            current.update();
            
        } else {
            gs.error('SmartAttestation Review: Failed to review attestation - ' + result.error);
            current.work_notes = 'SmartAttestation Review failed: ' + result.error;
            current.update();
        }
    } catch(e) {
        gs.error('SmartAttestation Review: Error during review - ' + e.getMessage());
        current.work_notes = 'SmartAttestation Review error: ' + e.getMessage();
        current.update();
    }
    
})(current, previous);