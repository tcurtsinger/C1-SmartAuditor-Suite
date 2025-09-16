  var SmartAttestationReviewAPI = Class.create();
  SmartAttestationReviewAPI.prototype = {
      initialize: function() {
          this.llmConnector = new LLMConnector();
          this.promptBuilder = new PromptBuilder();
          this.complianceAnalyzer = new ComplianceAnalyzer();
          this.enableAutoReview = gs.getProperty('x_n1ll2_c1_smart_6.llm.enable_auto_review', 'true') === 'true';
      },

    /**
     * Main entry point for reviewing an attestation
     * @param {String} attestationSysId - sys_id of the attestation (asmt_assessment_instance)
     * @return {Object} Review result with status and details
     */
    reviewAttestation: function(attestationSysId) {
        var startTime = new Date().getTime();
        
        try {
            // Step 1: Gather attestation data
            var attestationData = this._getAttestationData(attestationSysId);
            if (!attestationData.success) {
                return attestationData;
            }

            // Step 2: Build the prompt
            var promptData = {
                controlObjectiveDescription: attestationData.controlObjectiveDescription,
                supplementalGuidance: attestationData.supplementalGuidance,
                attestationResponse: attestationData.attestationResponse,
                controlNumber: attestationData.controlNumber,
                controlReference: attestationData.controlReference,
                controlName: attestationData.controlName,
                controlSource: attestationData.controlSource,
                controlParent: attestationData.controlParent,
                framework: attestationData.framework
            };
            
            var prompt = this.promptBuilder.buildStructuredPrompt(promptData);

            // Step 3: Send to LLM
            gs.info('SmartAttestationReview: Sending prompt to LLM for attestation ' + attestationSysId);
            var llmResponse = this.llmConnector.sendPrompt(prompt);
            
            if (!llmResponse.success) {
                gs.error('SmartAttestationReview: LLM call failed - ' + llmResponse.error);
                return {
                    success: false,
                    error: 'LLM analysis failed: ' + llmResponse.error
                };
            }

            // Step 4: Parse and analyze the response
            var analysis = this.complianceAnalyzer.parseAnalysis(llmResponse.content, 'json');
            
            // Step 5: Determine actions based on analysis
            var actionResult = this._determineActions(analysis, attestationData);
            
            // Step 6: Save analysis to database
            var processingTime = new Date().getTime() - startTime;
            var saveData = {
                control_objective_sys_id: attestationData.controlObjectiveSysId,
                control_sys_id: attestationData.controlSysId,
                attestation_sys_id: attestationSysId,
                attestation_metric_sys_id: attestationData.metricSysId,
                attestation_response: attestationData.attestationResponse,
                control_objective_desc: attestationData.controlObjectiveDescription,
                supplemental_guidance: attestationData.supplementalGuidance,
                analysis_result: analysis.raw_response || llmResponse.content,
                compliance_status: analysis.compliance_status,
                risk_score: analysis.risk_score,
                recommendations: analysis.recommendations,
                gaps: analysis.gaps,
                evidence_needed: analysis.evidence_needed, // Add evidence_needed
                auto_approved: actionResult.autoApproved,
                llm_provider: llmResponse.provider,
                processing_time: processingTime
            };
            
            var saveResult = this.complianceAnalyzer.saveAnalysis(saveData);
            
            // Step 7: Execute actions
            if (this.enableAutoReview && actionResult.action) {
                this._executeAction(actionResult.action, attestationSysId, analysis);
            }

            return {
                success: true,
                analysis: analysis,
                action: actionResult.action,
                autoApproved: actionResult.autoApproved,
                reviewRecordId: saveResult.sys_id,
                processingTime: processingTime
            };

        } catch (e) {
            gs.error('SmartAttestationReview error: ' + e.getMessage());
            return {
                success: false,
                error: 'Review process failed: ' + e.getMessage()
            };
        }
    },

    /**
     * Get attestation data from ServiceNow tables
     */
    _getAttestationData: function(attestationSysId) {
        try {
            var gr = new GlideRecord('asmt_assessment_instance');
            if (!gr.get(attestationSysId)) {
                return {
                    success: false,
                    error: 'Attestation not found: ' + attestationSysId
                };
            }

            // For GRC Classic Attestation, get the response from asmt_assessment_instance_question
            var response = '';
            var controlObjective = null;
            var controlSysId = null;
            var metricQuestion = '';
            
            // Query the question table for the actual response
            var qGr = new GlideRecord('asmt_assessment_instance_question');
            qGr.addQuery('instance', attestationSysId);
            qGr.query();
            
            while (qGr.next()) {
                // Get the response text (usually from "Explain" question)
                // Convert GlideElement to string and trim whitespace
                var questionResponse = qGr.getValue('string_value') || '';
                questionResponse = questionResponse.trim();
                
                // Only set response if it's not empty and we haven't found one yet
                if (questionResponse && !response) {
                    response = questionResponse;
                }
                
                // Get the metric info
                if (qGr.metric) {
                    var metric = qGr.metric.getRefRecord();
                    if (metric && metric.isValidRecord()) {
                        metricQuestion = metric.question || metric.name || '';
                    }
                }
                
                // Get control objective from source_id if it points to sn_compliance_control
                // Only get control objective if we haven't found one yet
                if (!controlObjective && qGr.source_table == 'sn_compliance_control' && qGr.source_id) {
                    var controlGr = new GlideRecord('sn_compliance_control');
                    if (controlGr.get(qGr.source_id)) {
                        // Capture the control sys_id
                        controlSysId = controlGr.getUniqueValue();
                        
                        // Get supplemental_guidance from the Control record (framework guidance)
                        var controlSupplementalGuidance = controlGr.getValue('supplemental_guidance') || '';
                        
                        // The content field on control points directly to control objective
                        if (controlGr.content) {
                            var coGr = controlGr.content.getRefRecord();
                            if (coGr && coGr.isValidRecord()) {
                                controlObjective = {
                                    sys_id: coGr.getUniqueValue(),
                                    description: coGr.getValue('description'),
                                    // Prefer Control's supplemental_guidance (framework guidance), fallback to CO's discussion
                                    supplemental_guidance: controlSupplementalGuidance || coGr.getValue('discussion') || '',
                                    number: coGr.getValue('number'),
                                    reference: coGr.getValue('reference'),
                                    name: coGr.getValue('name'),
                                    source: coGr.getValue('source'),
                                    parent: coGr.parent ? coGr.parent.getDisplayValue() : '',
                                    framework: this._normalizeFramework(coGr.getValue('source')) // Use normalized source value
                                };
                            }
                        }
                    }
                }
            }
            
            // If no response found, check the main attestation record
            if (!response) {
                response = gr.string_value || gr.getValue('string_value') || '';
            }
            
            // If no control objective found yet, try alternative methods
            if (!controlObjective) {
                // Try through metric if available
                if (gr.metric) {
                    var metric = gr.metric.getRefRecord();
                    if (metric && metric.isValidRecord()) {
                        controlObjective = this._getControlObjective(metric);
                    }
                }
            }
            
            if (!controlObjective) {
                return {
                    success: false,
                    error: 'Control objective not found for attestation'
                };
            }
            
            if (!response) {
                return {
                    success: false,
                    error: 'No response text found in attestation'
                };
            }

            return {
                success: true,
                attestationResponse: response,
                controlSysId: controlSysId,
                controlObjectiveSysId: controlObjective.sys_id,
                controlObjectiveDescription: controlObjective.description || '',
                supplementalGuidance: controlObjective.supplemental_guidance || '',
                controlNumber: controlObjective.number || '',
                controlReference: controlObjective.reference || '',
                controlName: controlObjective.name || '',
                controlSource: controlObjective.source || '',
                controlParent: controlObjective.parent || '',
                framework: controlObjective.framework || 'generic',
                metricQuestion: metricQuestion
            };

        } catch (e) {
            gs.error('SmartAttestationReview getData error: ' + e.getMessage());
            return {
                success: false,
                error: 'Failed to retrieve attestation data: ' + e.getMessage()
            };
        }
    },

    /**
     * Normalize framework/source value to match template expectations
     */
    _normalizeFramework: function(source) {
        if (!source) return 'generic';
        
        var normalized = source.toLowerCase();
        
        // NIST variations
        if (normalized.indexOf('nist') > -1) {
            return 'nist';
        }
        // SOC 2 variations
        else if (normalized.indexOf('soc 2') > -1 || normalized.indexOf('soc2') > -1) {
            return 'soc_2';
        }
        // ISO 27001 variations
        else if (normalized.indexOf('iso 27001') > -1 || normalized.indexOf('iso27001') > -1) {
            return 'iso_27001';
        }
        // HIPAA
        else if (normalized.indexOf('hipaa') > -1) {
            return 'hipaa';
        }
        // PCI DSS
        else if (normalized.indexOf('pci') > -1) {
            return 'pci_dss';
        }
        // CIS
        else if (normalized.indexOf('cis') > -1) {
            return 'cis';  // Now returns 'cis' instead of generic
        }
        // CSA CCM
        else if (normalized.indexOf('csa') > -1 || normalized.indexOf('ccm') > -1) {
            return 'csa_ccm';  // Now returns 'csa_ccm' instead of generic
        }
        
        return 'generic';
    },
    
    /**
     * Get control objective related to the metric
     */
    _getControlObjective: function(metric) {
        // Try different approaches to find the control objective
        
        // Approach 1: Direct reference from metric
        if (metric.control_objective) {
            var co = metric.control_objective.getRefRecord();
            if (co && co.isValidRecord()) {
                return {
                    sys_id: co.getUniqueValue(),
                    description: co.getValue('description'),
                    supplemental_guidance: co.getValue('discussion') || co.getValue('supplemental_guidance') || '', // Use 'discussion' field
                    number: co.getValue('number'),
                    reference: co.getValue('reference'),
                    name: co.getValue('name'),
                    source: co.getValue('source'),
                    parent: co.parent ? co.parent.getDisplayValue() : '',
                    framework: this._normalizeFramework(co.getValue('source')) // Use normalized source value
                };
            }
        }

        // Approach 2: Through assessment metric type
        if (metric.metric_type) {
            var typeGr = new GlideRecord('asmt_metric_type');
            typeGr.get(metric.metric_type);
            
            // Check if metric type has reference to control objective
            if (typeGr.isValidRecord() && typeGr.reference_table == 'sn_compliance_policy_statement') {
                var coGr = new GlideRecord('sn_compliance_policy_statement');
                if (coGr.get(typeGr.reference_id)) {
                    return {
                        sys_id: coGr.getUniqueValue(),
                        description: coGr.getValue('description'),
                        supplemental_guidance: coGr.getValue('discussion') || coGr.getValue('supplemental_guidance') || '', // Use 'discussion' field
                        number: coGr.getValue('number'),
                        reference: coGr.getValue('reference'),
                        name: coGr.getValue('name'),
                        source: coGr.getValue('source'),
                        parent: coGr.parent ? coGr.parent.getDisplayValue() : '',
                        framework: this._normalizeFramework(coGr.getValue('source')) // Use normalized source value
                    };
                }
            }
        }

        // Approach 3: Through metric category or other relationships
        // This would depend on your specific ServiceNow configuration
        // You might need to customize this based on how your attestations are linked to control objectives
        
        gs.warn('SmartAttestationReview: Could not find control objective for metric ' + metric.getUniqueValue());
        return null;
    },

    /**
     * Determine what actions to take based on analysis
     */
    _determineActions: function(analysis, attestationData) {
        var action = {
            type: null,
            autoApproved: false,
            details: {}
        };

        if (!analysis || !analysis.success) {
            action.type = 'manual_review';
            action.details.reason = 'Analysis failed';
            return action;
        }

        // Check for auto-approval
        if (this.complianceAnalyzer.canAutoApprove(analysis)) {
            action.type = 'approve';
            action.autoApproved = true;
            action.details.reason = 'Auto-approved: Compliant with low risk';
        }
        // Non-compliant - return for revision
        else if (analysis.compliance_status === 'NON-COMPLIANT') {
            action.type = 'return_for_revision';
            action.details.reason = 'Non-compliant attestation';
            action.details.recommendations = analysis.recommendations;
            action.details.gaps = analysis.gaps;
        }
        // Needs manual review
        else {
            action.type = 'manual_review';
            action.details.reason = 'Requires manual review';
            action.details.risk_score = analysis.risk_score;
        }

        return action;
    },

    /**
     * Execute the determined action
     */
    _executeAction: function(action, attestationSysId, analysis) {
        try {
            var gr = new GlideRecord('asmt_assessment_instance');
            if (!gr.get(attestationSysId)) {
                gs.error('SmartAttestationReview: Cannot execute action - attestation not found');
                return false;
            }

            switch(action.type) {
                case 'approve':
                    // Move to approved/monitor state
                    gr.setValue('state', 'complete'); // Adjust based on your state field values
                    gr.setValue('actual_state', 'complete');
                    gr.work_notes = 'Auto-approved by SmartAttestation Review\n' +
                                   'Compliance Status: ' + analysis.compliance_status + '\n' +
                                   'Risk Score: ' + analysis.risk_score;
                    gr.update();
                    gs.info('SmartAttestationReview: Auto-approved attestation ' + attestationSysId);
                    break;

                case 'return_for_revision':
                    // Return to draft/attest state with feedback
                    gr.setValue('state', 'in_progress'); // Adjust based on your state field values
                    gr.setValue('actual_state', 'in_progress');
                    
                    var feedback = 'Returned by SmartAttestation Review\n\n';
                    feedback += 'Compliance Status: NON-COMPLIANT\n';
                    feedback += 'Risk Score: ' + analysis.risk_score + '\n\n';
                    
                    if (action.details.gaps && action.details.gaps.length > 0) {
                        feedback += 'Gaps Identified:\n';
                        action.details.gaps.forEach(function(gap) {
                            feedback += '• ' + gap + '\n';
                        });
                        feedback += '\n';
                    }
                    
                    if (action.details.recommendations && action.details.recommendations.length > 0) {
                        feedback += 'Recommendations:\n';
                        action.details.recommendations.forEach(function(rec) {
                            feedback += '• ' + rec + '\n';
                        });
                    }
                    
                    gr.work_notes = feedback;
                    gr.update();
                    gs.info('SmartAttestationReview: Returned attestation ' + attestationSysId + ' for revision');
                    break;

                case 'manual_review':
                    // Add to review queue or set flag for manual review
                    gr.work_notes = 'Flagged for manual review by SmartAttestation Review\n' +
                                   'Reason: ' + action.details.reason + '\n' +
                                   'Risk Score: ' + (action.details.risk_score || 'N/A');
                    gr.update();
                    gs.info('SmartAttestationReview: Flagged attestation ' + attestationSysId + ' for manual review');
                    break;
            }

            return true;

        } catch (e) {
            gs.error('SmartAttestationReview executeAction error: ' + e.getMessage());
            return false;
        }
    },

    /**
     * Batch review multiple attestations
     */
    batchReview: function(attestationSysIds) {
        var results = [];
        
        attestationSysIds.forEach(function(sysId) {
            results.push(this.reviewAttestation(sysId));
        }, this);
        
        return results;
    },

    /**
     * Review all pending attestations for a control objective
     */
    reviewByControlObjective: function(controlObjectiveSysId) {
        var attestations = [];
        
        // Find all attestations related to this control objective
        // This query would need to be adjusted based on your data model
        var gr = new GlideRecord('asmt_assessment_instance');
        gr.addQuery('state', 'in_progress'); // Or whatever state indicates pending review
        // Add more query conditions to link to control objective
        gr.query();
        
        while (gr.next()) {
            attestations.push(gr.getUniqueValue());
        }
        
        return this.batchReview(attestations);
    },

    /**
     * Test the LLM connection
     */
    testConnection: function() {
        var testPrompt = 'Please respond with "Connection successful" if you receive this message.';
        var response = this.llmConnector.sendPrompt(testPrompt);
        
        return {
            success: response.success,
            message: response.success ? 'LLM connection successful' : 'Connection failed: ' + response.error,
            provider: response.provider || 'Unknown'
        };
    },

    type: 'SmartAttestationReviewAPI'
};