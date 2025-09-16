var ComplianceAnalyzer = Class.create();
ComplianceAnalyzer.prototype = {
    initialize: function() {
        this.analysisTable = 'x_n1ll2_c1_smart_6_review_analysis';
        this.defaultRiskThreshold = 3; // Risk score <= 3 is considered low risk
        this.autoApproveThreshold = gs.getProperty('x_n1ll2_c1_smart_6.llm.auto_approve_threshold', '3');
    },

    /**
     * Parse and analyze the LLM response
     * @param {String} llmResponse - Raw response from LLM
     * @param {String} format - Expected format ('json' or 'text')
     * @return {Object} Structured analysis result
     */
    parseAnalysis: function(llmResponse, format) {
        if (!llmResponse) {
            return this._createErrorResult('No response received from LLM');
        }

        try {
            if (format === 'json') {
                return this._parseJSONResponse(llmResponse);
            } else {
                return this._parseTextResponse(llmResponse);
            }
        } catch (e) {
            gs.error('ComplianceAnalyzer parse error: ' + e.getMessage());
            return this._createErrorResult('Failed to parse LLM response: ' + e.getMessage());
        }
    },

    /**
     * Parse JSON formatted response
     */
    _parseJSONResponse: function(response) {
        // Try to extract JSON from the response
        var jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            // Fallback to text parsing if no JSON found
            return this._parseTextResponse(response);
        }

        try {
            var parsed = JSON.parse(jsonMatch[0]);
            
            return {
                success: true,
                compliance_status: this._normalizeComplianceStatus(parsed.compliance_status),
                risk_score: this._normalizeRiskScore(parsed.risk_score),
                gaps: parsed.gaps || [],
                recommendations: parsed.recommendations || [],
                evidence_needed: parsed.evidence_needed || [],
                summary: parsed.summary || '',
                raw_response: response
            };
        } catch (e) {
            // JSON parse failed, try text parsing
            return this._parseTextResponse(response);
        }
    },

    /**
     * Parse text formatted response
     */
    _parseTextResponse: function(response) {
        var result = {
            success: true,
            compliance_status: 'NEEDS REVIEW',
            risk_score: 5,
            gaps: [],
            recommendations: [],
            evidence_needed: [],
            summary: '',
            raw_response: response
        };

        var lines = response.split('\n');
        var currentSection = '';

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            
            // Detect compliance status
            if (line.toUpperCase().indexOf('COMPLIANCE STATUS') > -1 || 
                line.toUpperCase().indexOf('STATUS:') > -1) {
                currentSection = 'status';
                var statusLine = lines[i + 1] || line;
                result.compliance_status = this._extractComplianceStatus(statusLine);
            }
            
            // Detect risk score
            else if (line.toUpperCase().indexOf('RISK SCORE') > -1) {
                currentSection = 'risk';
                var scoreLine = lines[i + 1] || line;
                result.risk_score = this._extractRiskScore(scoreLine);
            }
            
            // Detect gaps section
            else if (line.toUpperCase().indexOf('GAPS IDENTIFIED') > -1 || 
                     line.toUpperCase().indexOf('GAPS:') > -1) {
                currentSection = 'gaps';
                continue;
            }
            
            // Detect recommendations section
            else if (line.toUpperCase().indexOf('RECOMMENDATIONS') > -1) {
                currentSection = 'recommendations';
                continue;
            }
            
            // Detect evidence section
            else if (line.toUpperCase().indexOf('EVIDENCE NEEDED') > -1 || 
                     line.toUpperCase().indexOf('EVIDENCE:') > -1) {
                currentSection = 'evidence';
                continue;
            }
            
            // Process content based on current section
            else if (line && !line.startsWith('===')) {
                this._addToSection(result, currentSection, line);
            }
        }

        // Generate summary if not found
        if (!result.summary) {
            result.summary = this._generateSummary(result);
        }

        return result;
    },

    /**
     * Extract compliance status from text
     */
    _extractComplianceStatus: function(text) {
        text = text.toUpperCase();
        
        if (text.indexOf('COMPLIANT') > -1 && text.indexOf('NON') === -1) {
            return 'COMPLIANT';
        } else if (text.indexOf('NON-COMPLIANT') > -1 || text.indexOf('NON COMPLIANT') > -1) {
            return 'NON-COMPLIANT';
        } else if (text.indexOf('NEEDS REVIEW') > -1 || text.indexOf('REVIEW') > -1) {
            return 'NEEDS REVIEW';
        }
        
        // Look for keywords
        if (text.indexOf('PASS') > -1 || text.indexOf('ADEQUATE') > -1 || text.indexOf('SATISF') > -1) {
            return 'COMPLIANT';
        } else if (text.indexOf('FAIL') > -1 || text.indexOf('INADEQUATE') > -1 || text.indexOf('DEFICIEN') > -1) {
            return 'NON-COMPLIANT';
        }
        
        return 'NEEDS REVIEW';
    },

    /**
     * Extract risk score from text
     */
    _extractRiskScore: function(text) {
        // Look for numbers 1-10
        var match = text.match(/\b([1-9]|10)\b/);
        if (match) {
            return parseInt(match[0]);
        }
        
        // Look for risk levels
        text = text.toUpperCase();
        if (text.indexOf('LOW') > -1) return 3;
        if (text.indexOf('MEDIUM') > -1 || text.indexOf('MODERATE') > -1) return 5;
        if (text.indexOf('HIGH') > -1) return 8;
        if (text.indexOf('CRITICAL') > -1) return 10;
        
        return 5; // Default to medium
    },

    /**
     * Add content to appropriate section
     */
    _addToSection: function(result, section, line) {
        // Clean up list markers
        line = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
        
        if (!line) return;
        
        switch(section) {
            case 'gaps':
                if (line.length > 5) { // Avoid adding very short/empty items
                    result.gaps.push(line);
                }
                break;
            case 'recommendations':
                if (line.length > 5) {
                    result.recommendations.push(line);
                }
                break;
            case 'evidence':
                if (line.length > 5) {
                    result.evidence_needed.push(line);
                }
                break;
        }
    },

    /**
     * Normalize compliance status to expected values
     */
    _normalizeComplianceStatus: function(status) {
        if (!status) return 'NEEDS REVIEW';
        
        status = status.toUpperCase().trim();
        
        if (status === 'COMPLIANT' || status === 'PASS' || status === 'PASSED') {
            return 'COMPLIANT';
        } else if (status === 'NON-COMPLIANT' || status === 'NON_COMPLIANT' || 
                   status === 'NONCOMPLIANT' || status === 'FAIL' || status === 'FAILED') {
            return 'NON-COMPLIANT';
        } else {
            return 'NEEDS REVIEW';
        }
    },

    /**
     * Normalize risk score to 1-10 range
     */
    _normalizeRiskScore: function(score) {
        if (typeof score === 'string') {
            score = parseInt(score);
        }
        
        if (isNaN(score) || score < 1) {
            return 5; // Default to medium
        } else if (score > 10) {
            return 10;
        }
        
        return score;
    },

    /**
     * Generate a summary based on the analysis
     */
    _generateSummary: function(result) {
        var summary = [];
        
        summary.push('Compliance Status: ' + result.compliance_status);
        summary.push('Risk Level: ' + this._getRiskLevel(result.risk_score));
        
        if (result.gaps.length > 0) {
            summary.push(result.gaps.length + ' gaps identified');
        }
        
        if (result.recommendations.length > 0) {
            summary.push(result.recommendations.length + ' recommendations provided');
        }
        
        return summary.join('. ');
    },

    /**
     * Get risk level description
     */
    _getRiskLevel: function(score) {
        if (score <= 3) return 'Low';
        if (score <= 6) return 'Medium';
        if (score <= 8) return 'High';
        return 'Critical';
    },

    /**
     * Create error result object
     */
    _createErrorResult: function(error) {
        return {
            success: false,
            error: error,
            compliance_status: 'NEEDS REVIEW',
            risk_score: 5,
            gaps: [],
            recommendations: [],
            evidence_needed: [],
            summary: 'Analysis failed: ' + error
        };
    },

    /**
     * Determine if attestation can be auto-approved
     */
    canAutoApprove: function(analysis) {
        if (!analysis || !analysis.success) {
            return false;
        }
        
        var autoApproveThreshold = parseInt(this.autoApproveThreshold);
        
        return analysis.compliance_status === 'COMPLIANT' && 
               analysis.risk_score <= autoApproveThreshold;
    },

    /**
     * Calculate review priority based on risk and status
     */
    calculatePriority: function(analysis) {
        if (!analysis) return 3; // Medium priority by default
        
        // Non-compliant items are highest priority
        if (analysis.compliance_status === 'NON-COMPLIANT') {
            if (analysis.risk_score >= 8) return 1; // Critical
            if (analysis.risk_score >= 5) return 2; // High
            return 3; // Medium
        }
        
        // Items needing review
        if (analysis.compliance_status === 'NEEDS REVIEW') {
            if (analysis.risk_score >= 7) return 2; // High
            return 3; // Medium
        }
        
        // Compliant items
        if (analysis.compliance_status === 'COMPLIANT') {
            if (analysis.risk_score >= 5) return 3; // Medium (compliant but risky)
            return 4; // Low
        }
        
        return 3; // Default medium
    },

    /**
     * Save analysis results to database
     */
    saveAnalysis: function(analysisData) {
        try {
            var gr = new GlideRecord(this.analysisTable);
            gr.initialize();
            
            // Set reference fields
            if (analysisData.control_objective_sys_id) {
                gr.setValue('control_objective', analysisData.control_objective_sys_id);
            }
            if (analysisData.control_sys_id) {
                gr.setValue('control', analysisData.control_sys_id);
            }
            if (analysisData.attestation_sys_id) {
                gr.setValue('attestation', analysisData.attestation_sys_id);
            }
            if (analysisData.attestation_metric_sys_id) {
                gr.setValue('attestation_metric', analysisData.attestation_metric_sys_id);
            }
            
            // Set analysis data
            gr.setValue('attestation_response', analysisData.attestation_response || '');
            gr.setValue('control_objective_description', analysisData.control_objective_desc || '');
            gr.setValue('supplemental_guidance', analysisData.supplemental_guidance || '');
            gr.setValue('analysis_result', analysisData.analysis_result || '');
            gr.setValue('compliance_status', analysisData.compliance_status || 'NEEDS REVIEW');
            gr.setValue('risk_score', analysisData.risk_score || 5);
            // Handle recommendations - could be in recommendations or evidence_needed
            var recommendations = analysisData.recommendations || [];
            if (analysisData.evidence_needed && analysisData.evidence_needed.length > 0) {
                // If we have evidence_needed but no recommendations, use evidence as recommendations
                if (recommendations.length === 0) {
                    recommendations = analysisData.evidence_needed.map(function(item) {
                        return 'Provide evidence: ' + item;
                    });
                } else {
                    // Append evidence needed to recommendations
                    analysisData.evidence_needed.forEach(function(item) {
                        recommendations.push('Evidence needed: ' + item);
                    });
                }
            }
            gr.setValue('recommendations', this._arrayToString(recommendations));
            gr.setValue('gaps_identified', this._arrayToString(analysisData.gaps));
            gr.setValue('auto_approved', analysisData.auto_approved || false);
            gr.setValue('review_date', new GlideDateTime());
            gr.setValue('llm_provider_used', analysisData.llm_provider || '');
            gr.setValue('processing_time_ms', analysisData.processing_time || 0);
            
            var sysId = gr.insert();
            
            return {
                success: true,
                sys_id: sysId
            };
            
        } catch (e) {
            gs.error('ComplianceAnalyzer saveAnalysis error: ' + e.getMessage());
            return {
                success: false,
                error: e.getMessage()
            };
        }
    },

    /**
     * Convert array to string for storage
     */
    _arrayToString: function(arr) {
        if (!arr || !Array.isArray(arr)) return '';
        return arr.join('\n');
    },

    type: 'ComplianceAnalyzer'
};