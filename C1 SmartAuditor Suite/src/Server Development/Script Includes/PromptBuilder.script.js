var PromptBuilder = Class.create();
PromptBuilder.prototype = {
    initialize: function() {
        this.templateCache = {};
        this.templateTable = 'x_n1ll2_c1_smart_6_prompt_templates';
    },

    /**
     * Get prompt template from database
     * @param {String} templateType - Type of template to retrieve
     * @param {String} framework - Optional framework filter
     * @return {Object} Template object or null
     */
    _getTemplate: function(templateType, framework) {
        // Check cache first
        var cacheKey = templateType + '_' + (framework || 'generic');
        if (this.templateCache[cacheKey]) {
            return this.templateCache[cacheKey];
        }
        
        var gr = new GlideRecord(this.templateTable);
        gr.addQuery('active', true);
        gr.addQuery('template_type', templateType);
        
        // Try framework-specific first, then generic
        // Note: framework values in DB use underscores: soc_2, iso_27001, pci_dss
        if (framework && framework !== 'generic') {
            // Convert framework to match database values if needed
            var dbFramework = framework;
            if (framework === 'soc2') dbFramework = 'soc_2';
            else if (framework === 'iso27001') dbFramework = 'iso_27001';
            else if (framework === 'pci' || framework === 'pcidss') dbFramework = 'pci_dss';
            
            // First try to get the framework-specific template
            gr.addQuery('framework', dbFramework);
            gr.orderBy('priority');  // Lower number = higher priority
            gr.setLimit(1);
            gr.query();
            
            if (gr.next()) {
                // Found framework-specific template
                var template = {
                    name: gr.getValue('name'),
                    prompt_text: gr.getValue('prompt_text'),
                    variables: gr.getValue('variables'),
                    temperature: parseFloat(gr.getValue('temperature')) || 0.3,
                    max_tokens: parseInt(gr.getValue('max_tokens')) || 2000
                };
                
                // Cache for future use
                this.templateCache[cacheKey] = template;
                return template;
            }
            
            // If no framework-specific template, fall back to generic
            gr = new GlideRecord(this.templateTable);
            gr.addQuery('active', true);
            gr.addQuery('template_type', templateType);
            gr.addQuery('framework', 'generic');
        } else {
            gr.addQuery('framework', 'generic');
        }
        
        gr.orderBy('priority');  // Lower number = higher priority (ServiceNow convention)
        gr.setLimit(1);
        gr.query();
        
        if (gr.next()) {
            var template = {
                name: gr.getValue('name'),
                prompt_text: gr.getValue('prompt_text'),
                variables: gr.getValue('variables'),
                temperature: parseFloat(gr.getValue('temperature')) || 0.3,
                max_tokens: parseInt(gr.getValue('max_tokens')) || 2000
            };
            
            // Cache for future use
            this.templateCache[cacheKey] = template;
            return template;
        }
        
        return null;
    },

    /**
     * Replace variables in template with actual values
     * @param {String} templateText - Template text with {{variables}}
     * @param {Object} data - Data object with variable values
     * @return {String} Processed template
     */
    _replaceVariables: function(templateText, data) {
        var processed = templateText;
        
        // Replace all {{variableName}} with actual values
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var regex = new RegExp('{{' + key + '}}', 'g');
                processed = processed.replace(regex, data[key] || '');
            }
        }
        
        // Remove any unreplaced variables
        processed = processed.replace(/{{[^}]+}}/g, '[Data not available]');
        
        return processed;
    },

    /**
     * Build a compliance analysis prompt using templates
     * @param {Object} data - Contains controlObjective, attestationResponse, supplementalGuidance, etc.
     * @return {String} Formatted prompt for LLM
     */
    buildCompliancePrompt: function(data) {
        // Try to get template from database
        var template = this._getTemplate('compliance_review', data.framework);
        
        if (template && template.prompt_text) {
            gs.info('PromptBuilder: Using template "' + template.name + '" from database');
            return this._replaceVariables(template.prompt_text, data);
        }
        
        // Fallback to hardcoded prompt if no template found
        gs.warn('PromptBuilder: No template found, using hardcoded prompt');
        return this._buildHardcodedCompliancePrompt(data);
    },
    
    /**
     * Hardcoded fallback prompt (original implementation)
     */
    _buildHardcodedCompliancePrompt: function(data) {
        var prompt = [];
        
        // System context
        prompt.push("You are a compliance expert analyzing an attestation response for regulatory compliance.");
        prompt.push("Your analysis must be objective, thorough, and based solely on the information provided.");
        prompt.push("");
        
        // Control Objective Information
        prompt.push("=== CONTROL OBJECTIVE ===");
        
        if (data.controlReference) {
            prompt.push("Reference: " + data.controlReference);
        }
        
        if (data.controlName) {
            prompt.push("Name: " + data.controlName);
        }
        
        if (data.controlSource) {
            prompt.push("Source: " + data.controlSource);
        }
        
        if (data.controlParent) {
            prompt.push("Parent: " + data.controlParent);
        }
        
        prompt.push("Description: " + (data.controlObjectiveDescription || "Not provided"));
        
        if (data.supplementalGuidance) {
            prompt.push("");
            prompt.push("Framework Supplemental Guidance (Implementation Direction): " + data.supplementalGuidance);
            prompt.push("Note: This guidance is from the compliance framework to help interpret the control requirements.");
        }
        
        if (data.controlNumber) {
            prompt.push("Control Number: " + data.controlNumber);
        }
        
        if (data.framework) {
            prompt.push("Framework: " + data.framework);
        }
        
        prompt.push("");
        
        // Attestation Response
        prompt.push("=== ATTESTATION RESPONSE ===");
        prompt.push(data.attestationResponse || "No response provided");
        prompt.push("");
        
        // Additional Context if available
        if (data.previousResponse) {
            prompt.push("=== PREVIOUS RESPONSE (for reference) ===");
            prompt.push(data.previousResponse);
            prompt.push("");
        }
        
        // Analysis Instructions
        prompt.push("=== ANALYSIS REQUIRED ===");
        prompt.push("Please analyze the attestation response against the control objective and provide:");
        prompt.push("");
        prompt.push("1. COMPLIANCE STATUS: Determine if the response demonstrates compliance");
        prompt.push("   - Mark as 'COMPLIANT' if the response adequately addresses the control objective");
        prompt.push("   - Mark as 'NON-COMPLIANT' if there are clear gaps or deficiencies");
        prompt.push("   - Mark as 'NEEDS REVIEW' if the response is unclear or partially addresses the control");
        prompt.push("");
        prompt.push("2. RISK SCORE: Provide a risk score from 1-10");
        prompt.push("   - 1-3: Low risk, strong compliance");
        prompt.push("   - 4-6: Medium risk, some concerns");
        prompt.push("   - 7-10: High risk, significant gaps");
        prompt.push("");
        prompt.push("3. GAPS IDENTIFIED: List specific gaps between the response and control requirements");
        prompt.push("");
        prompt.push("4. RECOMMENDATIONS: Provide specific, actionable recommendations to achieve compliance");
        prompt.push("");
        prompt.push("5. EVIDENCE NEEDED: Suggest specific evidence that would strengthen the attestation");
        prompt.push("");
        
        // Response Format
        prompt.push("=== RESPONSE FORMAT ===");
        prompt.push("Structure your response with clear headers for each section above.");
        prompt.push("Be specific and reference the control objective requirements directly.");
        prompt.push("Focus on factual analysis rather than assumptions.");
        
        return prompt.join("\n");
    },

    /**
     * Build a prompt for risk assessment
     */
    buildRiskPrompt: function(data) {
        var prompt = [];
        
        prompt.push("Assess the compliance risk for the following control attestation:");
        prompt.push("");
        prompt.push("Control: " + (data.controlName || "Unknown"));
        prompt.push("Response: " + (data.attestationResponse || "No response"));
        prompt.push("");
        prompt.push("Provide a risk score (1-10) and brief justification.");
        
        return prompt.join("\n");
    },

    /**
     * Build a prompt for generating recommendations
     */
    buildRecommendationPrompt: function(data) {
        var prompt = [];
        
        prompt.push("Based on the following compliance gap analysis:");
        prompt.push("");
        prompt.push("Control Objective: " + (data.controlObjectiveDescription || ""));
        prompt.push("Current State: " + (data.currentState || ""));
        prompt.push("Gaps Identified: " + (data.gaps || ""));
        prompt.push("");
        prompt.push("Provide specific, actionable recommendations to achieve compliance.");
        prompt.push("Each recommendation should be:");
        prompt.push("- Clear and specific");
        prompt.push("- Implementable");
        prompt.push("- Directly address identified gaps");
        
        return prompt.join("\n");
    },

    /**
     * Build a structured prompt for JSON response using templates
     */
    buildStructuredPrompt: function(data) {
        // Try to get template from database
        var template = this._getTemplate('compliance_review', data.framework);
        
        if (template && template.prompt_text) {
            gs.info('PromptBuilder: Using template "' + template.name + '" for structured prompt');
            var processedPrompt = this._replaceVariables(template.prompt_text, data);
            
            // Check if template already includes JSON format
            if (processedPrompt.indexOf('"compliance_status"') === -1) {
                // Add JSON format if not in template
                processedPrompt += "\n\n=== JSON OUTPUT REQUIRED ===\n";
                processedPrompt += "Provide your analysis in the following JSON format:\n";
                processedPrompt += "{\n";
                processedPrompt += '  "compliance_status": "COMPLIANT" | "NON-COMPLIANT" | "NEEDS REVIEW",\n';
                processedPrompt += '  "risk_score": <number 1-10>,\n';
                processedPrompt += '  "gaps": ["gap1", "gap2", ...],\n';
                processedPrompt += '  "recommendations": ["recommendation1", "recommendation2", ...],\n';
                processedPrompt += '  "evidence_needed": ["evidence1", "evidence2", ...],\n';
                processedPrompt += '  "summary": "Brief summary of the analysis"\n';
                processedPrompt += "}\n";
            }
            
            return processedPrompt;
        }
        
        // Fallback to original implementation
        gs.warn('PromptBuilder: No template found for structured prompt, using hardcoded version');
        var prompt = this._buildHardcodedCompliancePrompt(data);
        
        prompt += "\n\n=== JSON OUTPUT REQUIRED ===\n";
        prompt += "Provide your analysis in the following JSON format:\n";
        prompt += "{\n";
        prompt += '  "compliance_status": "COMPLIANT" | "NON-COMPLIANT" | "NEEDS REVIEW",\n';
        prompt += '  "risk_score": <number 1-10>,\n';
        prompt += '  "gaps": ["gap1", "gap2", ...],\n';
        prompt += '  "recommendations": ["recommendation1", "recommendation2", ...],\n';
        prompt += '  "evidence_needed": ["evidence1", "evidence2", ...],\n';
        prompt += '  "summary": "Brief summary of the analysis"\n';
        prompt += "}\n";
        
        return prompt;
    },

    /**
     * Build a prompt for comparing attestations
     */
    buildComparisonPrompt: function(currentResponse, previousResponse, controlObjective) {
        var prompt = [];
        
        prompt.push("Compare the following attestation responses for the same control objective:");
        prompt.push("");
        prompt.push("=== CONTROL OBJECTIVE ===");
        prompt.push(controlObjective);
        prompt.push("");
        prompt.push("=== PREVIOUS RESPONSE ===");
        prompt.push(previousResponse);
        prompt.push("");
        prompt.push("=== CURRENT RESPONSE ===");
        prompt.push(currentResponse);
        prompt.push("");
        prompt.push("Analyze:");
        prompt.push("1. Has compliance improved, deteriorated, or remained the same?");
        prompt.push("2. What specific changes were made?");
        prompt.push("3. Are there any new risks introduced?");
        prompt.push("4. Is the current response more comprehensive?");
        
        return prompt.join("\n");
    },

    /**
     * Build a prompt for evidence validation using templates
     */
    buildEvidenceValidationPrompt: function(attestation, evidenceList) {
        // Try to get evidence validation template
        var data = {
            controlObjectiveDescription: "Evidence Validation Required",
            attestationResponse: attestation,
            framework: "generic"
        };
        
        var template = this._getTemplate('evidence_validation', data.framework);
        
        if (template && template.prompt_text) {
            gs.info('PromptBuilder: Using evidence validation template');
            return this._replaceVariables(template.prompt_text, data);
        }
        
        // Fallback to hardcoded
        var prompt = [];
        
        prompt.push("Validate if the provided evidence supports the attestation:");
        prompt.push("");
        prompt.push("=== ATTESTATION ===");
        prompt.push(attestation);
        prompt.push("");
        prompt.push("=== EVIDENCE PROVIDED ===");
        
        if (evidenceList && evidenceList.length > 0) {
            evidenceList.forEach(function(evidence, index) {
                prompt.push((index + 1) + ". " + evidence);
            });
        } else {
            prompt.push("No evidence provided");
        }
        
        prompt.push("");
        prompt.push("Determine:");
        prompt.push("1. Does the evidence adequately support the attestation claims?");
        prompt.push("2. What additional evidence would strengthen the attestation?");
        prompt.push("3. Are there any contradictions between evidence and claims?");
        
        return prompt.join("\n");
    },
    
    /**
     * Build prompt using specific template type
     * @param {String} templateType - Type of template (compliance_review, risk_assessment, gap_analysis, evidence_validation)
     * @param {Object} data - Data for variable replacement
     * @return {String} Processed prompt or error message
     */
    buildPromptFromTemplate: function(templateType, data) {
        var template = this._getTemplate(templateType, data.framework);
        
        if (template && template.prompt_text) {
            gs.info('PromptBuilder: Using template type "' + templateType + '"');
            return {
                success: true,
                prompt: this._replaceVariables(template.prompt_text, data),
                temperature: template.temperature,
                max_tokens: template.max_tokens,
                template_name: template.name
            };
        }
        
        gs.warn('PromptBuilder: Template type "' + templateType + '" not found');
        return {
            success: false,
            error: 'Template type "' + templateType + '" not found in database',
            prompt: null
        };
    },

    /**
     * Build a simplified prompt for quick assessment
     */
    buildQuickAssessmentPrompt: function(response, controlObjective) {
        var prompt = [];
        
        prompt.push("Quick compliance check:");
        prompt.push("Control: " + controlObjective);
        prompt.push("Response: " + response);
        prompt.push("");
        prompt.push("Is this response COMPLIANT or NON-COMPLIANT? Provide a one-line reason.");
        
        return prompt.join("\n");
    },

    /**
     * Add context about the organization (if available)
     */
    addOrganizationalContext: function(prompt, context) {
        if (!context) return prompt;
        
        var contextSection = [];
        contextSection.push("");
        contextSection.push("=== ORGANIZATIONAL CONTEXT ===");
        
        if (context.industry) {
            contextSection.push("Industry: " + context.industry);
        }
        if (context.size) {
            contextSection.push("Organization Size: " + context.size);
        }
        if (context.maturityLevel) {
            contextSection.push("Compliance Maturity: " + context.maturityLevel);
        }
        if (context.previousFindings) {
            contextSection.push("Previous Audit Findings: " + context.previousFindings);
        }
        
        contextSection.push("");
        
        // Insert context before analysis instructions
        var lines = prompt.split("\n");
        var insertIndex = lines.indexOf("=== ANALYSIS REQUIRED ===");
        if (insertIndex > -1) {
            // Use apply instead of spread operator for ES5 compatibility
            Array.prototype.splice.apply(lines, [insertIndex, 0].concat(contextSection));
        } else {
            // Use apply instead of spread operator
            Array.prototype.push.apply(lines, contextSection);
        }
        
        return lines.join("\n");
    },

    type: 'PromptBuilder'
};