/**
 * Business Rule: SmartAttestation Validate Before Complete
 * Table: asmt_assessment_instance
 * When: Before Update
 * Condition: current.state.changes() && current.state == 'complete' && previous.state != 'complete'
 * Order: 50 (runs before OOB rules)
 * Description: Checks if attestation should be reviewed (cannot make HTTP calls in Before rule)
 * 
 * NOTE: This rule only checks if a recent review exists. The actual review
 * is performed by the After rule (OnAttestationSubmitPP) which can make async calls.
 */

(function executeRule(current, previous /*null when async*/) {
    
    // Check if SmartAttestation Review is enabled
    var enableAutoReview = gs.getProperty('x_n1ll2_c1_smart_6.llm.enable_auto_review', 'true');
    if (enableAutoReview !== 'true') {
        // If auto-review is disabled, allow normal processing
        return;
    }
    
    // SIMPLIFIED CHECK: If sn_grc_item is populated, this is a GRC attestation
    if (!current.sn_grc_item) {
        // Not a GRC attestation, skip processing
        return;
    }
    
    gs.info('SmartAttestation Review: Processing GRC attestation ' + current.getUniqueValue() + ' for item: ' + current.sn_grc_item.getDisplayValue());
    
    // Check if attestation has already been reviewed
    var reviewGr = new GlideRecord('x_n1ll2_c1_smart_6_review_analysis');
    reviewGr.addQuery('attestation', current.getUniqueValue());
    reviewGr.orderByDesc('sys_created_on');
    reviewGr.setLimit(1);
    reviewGr.query();
    
    if (reviewGr.next()) {
        // Check if review was done recently (within last 5 minutes)
        var reviewTime = reviewGr.getValue('sys_created_on');
        var fiveMinutesAgo = new GlideDateTime();
        fiveMinutesAgo.addSeconds(-300);
        
        if (reviewTime > fiveMinutesAgo) {
            // Recent review exists, check compliance status
            var complianceStatus = reviewGr.getValue('compliance_status');
            var riskScore = parseInt(reviewGr.getValue('risk_score')) || 10;
            
            if (complianceStatus === 'NON-COMPLIANT') {
                // Block the transition
                gs.addErrorMessage('Attestation cannot be approved: LLM analysis determined NON-COMPLIANT status.');
                gs.addErrorMessage('Please review the gaps and recommendations in the work notes.');
                current.setAbortAction(true);
                return;
            }
            
            if (complianceStatus === 'NEEDS REVIEW' && riskScore > 6) {
                // Block high-risk items that need review
                gs.addErrorMessage('Attestation requires manual review: High risk score (' + riskScore + '/10).');
                gs.addErrorMessage('Please have a compliance officer review before approval.');
                current.setAbortAction(true);
                return;
            }
            
            // Review passed, allow transition
            return;
        }
    }
    
    // No recent review found
    // IMPORTANT: Cannot make HTTP calls in a Before rule (synchronous context)
    // The actual review will be performed by the After rule
    // For now, just add a note that review is pending
    
    gs.info('SmartAttestation: Review pending for attestation ' + current.getUniqueValue());
    gs.addInfoMessage('Attestation will be reviewed by SmartAttestation Review after submission.');
    
    // Allow the transition to continue
    // The After rule will perform the actual review and can reverse the state if needed
    
})(current, previous);