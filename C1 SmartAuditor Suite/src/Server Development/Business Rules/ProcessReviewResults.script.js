/**
 * Business Rule: Process SmartAttestation Review Results
 * Table: x_n1ll2_c1_smart_6_review_analysis
 * When: After Insert
 * Condition: true
 * Order: 100
 */

(function executeRule(current, previous /*null when async*/) {
    
    // Only process if we have an attestation reference
    if (!current.attestation) {
        return;
    }
    
    // Get the attestation record
    var attestation = current.attestation.getRefRecord();
    if (!attestation || !attestation.isValidRecord()) {
        gs.error('SmartAttestation Review: Cannot find attestation for review analysis ' + current.getUniqueValue());
        return;
    }
    
    // Check if auto-actions are enabled
    var enableAutoActions = gs.getProperty('x_n1ll2_c1_smart_6.llm.enable_auto_actions', 'true');
    if (enableAutoActions !== 'true') {
        gs.info('SmartAttestation Review: Auto-actions are disabled, review saved only');
        return;
    }
    
    // Process based on compliance status
    var complianceStatus = current.getValue('compliance_status');
    var riskScore = parseInt(current.getValue('risk_score'));
    var autoApproveThreshold = parseInt(gs.getProperty('x_n1ll2_c1_smart_6.llm.auto_approve_threshold', '3'));
    
    gs.info('SmartAttestation Review: Processing result - Status: ' + complianceStatus + ', Risk: ' + riskScore);
    
    switch(complianceStatus) {
        case 'COMPLIANT':
            if (riskScore <= autoApproveThreshold) {
                // Auto-approve
                processAutoApproval(attestation, current);
            } else {
                // Compliant but risky - flag for review
                flagForReview(attestation, current, 'Compliant but elevated risk score: ' + riskScore);
            }
            break;
            
        case 'NON-COMPLIANT':
            // Return for revision
            returnForRevision(attestation, current);
            break;
            
        case 'NEEDS REVIEW':
        default:
            // Flag for manual review
            flagForReview(attestation, current, 'Requires manual review');
            break;
    }
    
    /**
     * Process auto-approval
     */
    function processAutoApproval(attestationGr, analysisGr) {
        try {
            // Update attestation state to complete/approved
            attestationGr.setValue('state', 'complete');
            attestationGr.setValue('actual_state', 'complete');
            
            // Add work note
            var workNote = 'AUTO-APPROVED by SmartAttestation Review\n';
            workNote += '================================\n';
            workNote += 'Review Date: ' + analysisGr.review_date + '\n';
            workNote += 'Compliance Status: COMPLIANT\n';
            workNote += 'Risk Score: ' + analysisGr.risk_score + '/10\n';
            workNote += 'Review Record: ' + analysisGr.getDisplayValue();
            
            attestationGr.work_notes = workNote;
            attestationGr.update();
            
            // Update the analysis record
            analysisGr.auto_approved = true;
            analysisGr.update();
            
            // IMPORTANT: Move the Control to Monitor state
            // The attestation's sn_grc_item points to the control
            if (attestationGr.sn_grc_item) {
                var controlGr = attestationGr.sn_grc_item.getRefRecord();
                if (controlGr && controlGr.isValidRecord()) {
                    // Check if it's a compliance control
                    if (controlGr.getTableName() == 'sn_compliance_control') {
                        // Move control to Monitor state
                        controlGr.setValue('state', 'monitor');
                        controlGr.setValue('status', 'compliant'); // Mark as compliant
                        
                        // Build detailed work note with link to review analysis
                        var workNote = '═══════════════════════════════════════════\n';
                        workNote += '🤖 SmartAttestation Review - AUTO-APPROVED\n';
                        workNote += '═══════════════════════════════════════════\n\n';
                        workNote += '📋 ATTESTATION DETAILS\n';
                        workNote += '───────────────────────\n';
                        workNote += 'Attestation: ' + attestationGr.number + '\n';
                        workNote += 'Submitted by: ' + attestationGr.user.getDisplayValue() + '\n';
                        workNote += 'Date: ' + analysisGr.review_date + '\n\n';
                        
                        workNote += '✅ COMPLIANCE ASSESSMENT\n';
                        workNote += '───────────────────────\n';
                        workNote += 'Status: COMPLIANT\n';
                        workNote += 'Risk Score: ' + analysisGr.risk_score + '/10 (Low Risk)\n';
                        workNote += 'Action: Auto-approved (within threshold of ' + gs.getProperty('x_n1ll2_c1_smart_6.llm.auto_approve_threshold', '3') + ')\n';
                        workNote += 'Control State: Moved to Monitor\n\n';
                        
                        // Add summary from analysis if available
                        var analysisResult = analysisGr.getValue('analysis_result');
                        if (analysisResult) {
                            try {
                                var jsonMatch = analysisResult.match(/\{[\s\S]*\}/);
                                if (jsonMatch) {
                                    var parsed = JSON.parse(jsonMatch[0]);
                                    if (parsed.summary) {
                                        workNote += '📝 ANALYSIS SUMMARY\n';
                                        workNote += '───────────────────────\n';
                                        workNote += parsed.summary + '\n\n';
                                    }
                                    
                                    // Add evidence needed if present
                                    if (parsed.evidence_needed && parsed.evidence_needed.length > 0) {
                                        workNote += '📎 EVIDENCE TO COLLECT (for next review)\n';
                                        workNote += '───────────────────────\n';
                                        parsed.evidence_needed.forEach(function(item) {
                                            workNote += '• ' + item + '\n';
                                        });
                                        workNote += '\n';
                                    }
                                }
                            } catch(e) {
                                // JSON parsing failed, skip summary
                            }
                        }
                        
                        workNote += '🔗 REVIEW DETAILS\n';
                        workNote += '───────────────────────\n';
                        workNote += 'Review Analysis: [code]<a href="x_n1ll2_c1_smart_6_review_analysis.do?sys_id=' + analysisGr.getUniqueValue() + '">' + analysisGr.number + '</a>[/code]\n';
                        workNote += 'Processing Time: ' + analysisGr.processing_time_ms + 'ms\n';
                        workNote += 'LLM Provider: ' + analysisGr.llm_provider_used + '\n\n';
                        workNote += '═══════════════════════════════════════════\n';
                        
                        controlGr.comments = workNote;
                        controlGr.update();
                        
                        gs.info('SmartAttestation Review: Moved control ' + controlGr.getDisplayValue() + ' to Monitor state');
                    }
                }
            }
            
            // Create an event for notification
            gs.eventQueue('x_n1ll2_c1_smart_6.attestation.auto_approved', attestationGr, analysisGr.getUniqueValue());
            
            gs.info('SmartAttestation Review: Auto-approved attestation ' + attestationGr.getUniqueValue());
            
        } catch (e) {
            gs.error('SmartAttestation Review: Error during auto-approval - ' + e.getMessage());
        }
    }
    
    /**
     * Return attestation for revision
     */
    function returnForRevision(attestationGr, analysisGr) {
        try {
            // DO NOT change attestation state - leave it as complete
            // A new attestation will be generated when control moves back to attest
            
            // Build detailed feedback
            var feedback = 'NON-COMPLIANT - SmartAttestation Review Results\n';
            feedback += '================================================\n';
            feedback += 'Review Date: ' + analysisGr.review_date + '\n';
            feedback += 'Compliance Status: NON-COMPLIANT\n';
            feedback += 'Risk Score: ' + analysisGr.risk_score + '/10\n';
            feedback += 'Action: Control moved back to Attest state\n';
            feedback += 'Note: A new attestation will be generated for this control\n\n';
            
            // Add gaps if identified
            var gaps = analysisGr.getValue('gaps_identified');
            if (gaps) {
                feedback += 'GAPS IDENTIFIED:\n';
                feedback += '----------------\n';
                var gapList = gaps.split('\n');
                gapList.forEach(function(gap) {
                    if (gap.trim()) {
                        feedback += '• ' + gap.trim() + '\n';
                    }
                });
                feedback += '\n';
            }
            
            // Add recommendations
            var recommendations = analysisGr.getValue('recommendations');
            if (recommendations) {
                feedback += 'RECOMMENDATIONS:\n';
                feedback += '----------------\n';
                var recList = recommendations.split('\n');
                recList.forEach(function(rec) {
                    if (rec.trim()) {
                        feedback += '• ' + rec.trim() + '\n';
                    }
                });
                feedback += '\n';
            }
            
            feedback += 'Review Record: ' + analysisGr.getDisplayValue();
            
            attestationGr.work_notes = feedback;
            attestationGr.update();
            
            // Add detailed work note to the Control and update its state
            if (attestationGr.sn_grc_item) {
                var controlGr = attestationGr.sn_grc_item.getRefRecord();
                if (controlGr && controlGr.isValidRecord()) {
                    if (controlGr.getTableName() == 'sn_compliance_control') {
                        // Move control back to Attest state for non-compliance
                        controlGr.setValue('state', 'attest'); // Move back to attest state
                        controlGr.setValue('status', 'non_compliant'); // Mark as non-compliant
                        
                        // Build detailed work note
                        var workNote = '═══════════════════════════════════════════\n';
                        workNote += '❌ SmartAttestation Review - NON-COMPLIANT\n';
                        workNote += '═══════════════════════════════════════════\n\n';
                        workNote += '📋 ATTESTATION DETAILS\n';
                        workNote += '───────────────────────\n';
                        workNote += 'Attestation: ' + attestationGr.number + '\n';
                        workNote += 'Submitted by: ' + attestationGr.user.getDisplayValue() + '\n';
                        workNote += 'Date: ' + analysisGr.review_date + '\n\n';
                        
                        workNote += '❌ COMPLIANCE ASSESSMENT\n';
                        workNote += '───────────────────────\n';
                        workNote += 'Status: NON-COMPLIANT\n';
                        workNote += 'Risk Score: ' + analysisGr.risk_score + '/10\n';
                        workNote += 'Action: Control returned for re-attestation\n';
                        workNote += 'Attestation State: Remains complete (new attestation will be generated)\n';
                        workNote += 'Control State: Moved back to Attest\n';
                        workNote += 'Control Status: Marked as Non-Compliant\n\n';
                        
                        // Add gaps
                        if (gaps) {
                            workNote += '🚨 GAPS IDENTIFIED\n';
                            workNote += '───────────────────────\n';
                            gapList.forEach(function(gap) {
                                if (gap.trim()) {
                                    workNote += '• ' + gap.trim() + '\n';
                                }
                            });
                            workNote += '\n';
                        }
                        
                        // Add recommendations
                        if (recommendations) {
                            workNote += '🔧 REQUIRED ACTIONS\n';
                            workNote += '───────────────────────\n';
                            recList.forEach(function(rec) {
                                if (rec.trim()) {
                                    workNote += '• ' + rec.trim() + '\n';
                                }
                            });
                            workNote += '\n';
                        }
                        
                        workNote += '🔗 REVIEW DETAILS\n';
                        workNote += '───────────────────────\n';
                        workNote += 'Review Analysis: [code]<a href="x_n1ll2_c1_smart_6_review_analysis.do?sys_id=' + analysisGr.getUniqueValue() + '">' + analysisGr.number + '</a>[/code]\n';
                        workNote += 'Processing Time: ' + analysisGr.processing_time_ms + 'ms\n';
                        workNote += 'LLM Provider: ' + analysisGr.llm_provider_used + '\n\n';
                        workNote += '❌ ACTION REQUIRED: Address gaps and resubmit attestation\n';
                        workNote += '═══════════════════════════════════════════\n';
                        
                        controlGr.comments = workNote;
                        controlGr.update();
                        
                        gs.info('SmartAttestation Review: Added non-compliance note to control ' + controlGr.getDisplayValue());
                    }
                }
            }
            
            // Create an event for notification
            gs.eventQueue('x_n1ll2_c1_smart_6.attestation.returned', attestationGr, analysisGr.getUniqueValue());
            
            // Optionally create a task for the control owner
            createRemediationTask(attestationGr, analysisGr);
            
            gs.info('SmartAttestation Review: Returned attestation ' + attestationGr.getUniqueValue() + ' for revision');
            
        } catch (e) {
            gs.error('SmartAttestation Review: Error during return for revision - ' + e.getMessage());
        }
    }
    
    /**
     * Flag attestation for manual review
     */
    function flagForReview(attestationGr, analysisGr, reason) {
        try {
            // Add work note
            var workNote = 'FLAGGED FOR MANUAL REVIEW by SmartAttestation Review\n';
            workNote += '====================================================\n';
            workNote += 'Review Date: ' + analysisGr.review_date + '\n';
            workNote += 'Reason: ' + reason + '\n';
            workNote += 'Compliance Status: ' + analysisGr.compliance_status + '\n';
            workNote += 'Risk Score: ' + analysisGr.risk_score + '/10\n';
            workNote += 'Review Record: ' + analysisGr.getDisplayValue();
            
            attestationGr.work_notes = workNote;
            
            // Optionally set a flag field if you have one
            // attestationGr.u_needs_manual_review = true;
            
            attestationGr.update();
            
            // IMPORTANT: Keep the Control in Review state (or move it there)
            // when risk score is above auto-approval threshold
            if (attestationGr.sn_grc_item) {
                var controlGr = attestationGr.sn_grc_item.getRefRecord();
                if (controlGr && controlGr.isValidRecord()) {
                    if (controlGr.getTableName() == 'sn_compliance_control') {
                        // Ensure control stays in Review state
                        controlGr.setValue('state', 'review'); // Adjust field name if different
                        
                        // Build detailed work note
                        var workNote = '═══════════════════════════════════════════\n';
                        workNote += '⚠️ SmartAttestation Review - MANUAL REVIEW REQUIRED\n';
                        workNote += '═══════════════════════════════════════════\n\n';
                        workNote += '📋 ATTESTATION DETAILS\n';
                        workNote += '───────────────────────\n';
                        workNote += 'Attestation: ' + attestationGr.number + '\n';
                        workNote += 'Submitted by: ' + attestationGr.user.getDisplayValue() + '\n';
                        workNote += 'Date: ' + analysisGr.review_date + '\n\n';
                        
                        workNote += '⚠️ COMPLIANCE ASSESSMENT\n';
                        workNote += '───────────────────────\n';
                        workNote += 'Status: ' + analysisGr.compliance_status + '\n';
                        workNote += 'Risk Score: ' + analysisGr.risk_score + '/10 (Elevated Risk)\n';
                        workNote += 'Reason: ' + reason + '\n';
                        workNote += 'Action: Requires manual review by compliance officer\n';
                        workNote += 'Control State: Kept in Review\n\n';
                        
                        // Add gaps if any
                        var gaps = analysisGr.getValue('gaps_identified');
                        if (gaps) {
                            workNote += '🔍 GAPS IDENTIFIED\n';
                            workNote += '───────────────────────\n';
                            gaps.split('\n').forEach(function(gap) {
                                if (gap.trim()) {
                                    workNote += '• ' + gap.trim() + '\n';
                                }
                            });
                            workNote += '\n';
                        }
                        
                        // Add recommendations
                        var recommendations = analysisGr.getValue('recommendations');
                        if (recommendations) {
                            workNote += '💡 RECOMMENDATIONS\n';
                            workNote += '───────────────────────\n';
                            recommendations.split('\n').forEach(function(rec) {
                                if (rec.trim()) {
                                    workNote += '• ' + rec.trim() + '\n';
                                }
                            });
                            workNote += '\n';
                        }
                        
                        workNote += '🔗 REVIEW DETAILS\n';
                        workNote += '───────────────────────\n';
                        workNote += 'Review Analysis: [code]<a href="x_n1ll2_c1_smart_6_review_analysis.do?sys_id=' + analysisGr.getUniqueValue() + '">' + analysisGr.number + '</a>[/code]\n';
                        workNote += 'Processing Time: ' + analysisGr.processing_time_ms + 'ms\n';
                        workNote += 'LLM Provider: ' + analysisGr.llm_provider_used + '\n\n';
                        workNote += '⚠️ ACTION REQUIRED: Manual review needed to approve or reject\n';
                        workNote += '═══════════════════════════════════════════\n';
                        
                        controlGr.comments = workNote;
                        controlGr.update();
                        
                        gs.info('SmartAttestation Review: Control ' + controlGr.getDisplayValue() + ' kept in Review state');
                    }
                }
            }
            
            // Create an event for notification
            gs.eventQueue('x_n1ll2_c1_smart_6.attestation.needs_review', attestationGr, analysisGr.getUniqueValue());
            
            gs.info('SmartAttestation Review: Flagged attestation ' + attestationGr.getUniqueValue() + ' for manual review');
            
        } catch (e) {
            gs.error('SmartAttestation Review: Error during flag for review - ' + e.getMessage());
        }
    }
    
    /**
     * Create a remediation task for non-compliant attestations
     */
    function createRemediationTask(attestationGr, analysisGr) {
        try {
            // This is optional - create a task record for tracking remediation
            // You would need to have a task table or use the OOB task table
            
            /*
            var task = new GlideRecord('task'); // or your custom task table
            task.initialize();
            task.short_description = 'Remediate Non-Compliant Attestation: ' + attestationGr.getDisplayValue();
            task.description = 'Attestation was found non-compliant by SmartAttestation Review.\n\n' +
                              'Gaps: ' + analysisGr.gaps_identified + '\n\n' +
                              'Recommendations: ' + analysisGr.recommendations;
            task.assigned_to = attestationGr.assigned_to; // Assign to attestation owner
            task.priority = analysisGr.risk_score > 7 ? 1 : (analysisGr.risk_score > 4 ? 2 : 3);
            task.due_date = new GlideDateTime();
            task.due_date.addDays(7); // Give 7 days to remediate
            task.insert();
            */
            
        } catch (e) {
            gs.error('SmartAttestation Review: Error creating remediation task - ' + e.getMessage());
        }
    }
    
})(current, previous);