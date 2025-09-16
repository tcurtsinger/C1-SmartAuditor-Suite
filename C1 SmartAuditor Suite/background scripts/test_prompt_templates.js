/**
 * Test Script for Prompt Templates
 * Run this in Scripts - Background to test the template functionality
 */

(function testPromptTemplates() {
    gs.info('=== Testing Prompt Templates ===');
    
    // Test data matching actual variable names
    var testData = {
        controlObjectiveDescription: "Ensure all user access is reviewed quarterly",
        supplementalGuidance: "Reviews should include verification of user roles and permissions",
        attestationResponse: "We perform quarterly access reviews using our IAM system",
        controlNumber: "AC-2.1",
        controlReference: "NIST 800-53",
        controlName: "Account Management",
        controlSource: "NIST",
        controlParent: "Access Control",
        framework: "nist"
    };
    
    try {
        // Test 1: Basic compliance prompt with templates
        gs.info('\n--- Test 1: buildCompliancePrompt ---');
        var promptBuilder = new PromptBuilder();
        var prompt1 = promptBuilder.buildCompliancePrompt(testData);
        
        if (prompt1 && prompt1.length > 0) {
            gs.info('✓ Template loaded successfully');
            gs.info('Prompt length: ' + prompt1.length + ' characters');
            gs.info('First 200 chars: ' + prompt1.substring(0, 200));
            
            // Check if variables were replaced
            if (prompt1.indexOf('{{') === -1) {
                gs.info('✓ All variables replaced successfully');
            } else {
                gs.warn('⚠ Some variables may not have been replaced');
            }
        } else {
            gs.error('✗ Failed to generate prompt');
        }
        
        // Test 2: Structured prompt (with JSON format)
        gs.info('\n--- Test 2: buildStructuredPrompt ---');
        var prompt2 = promptBuilder.buildStructuredPrompt(testData);
        
        if (prompt2 && prompt2.indexOf('compliance_status') > -1) {
            gs.info('✓ Structured prompt includes JSON format');
        } else {
            gs.error('✗ Structured prompt missing JSON format');
        }
        
        // Test 3: Test specific template types
        gs.info('\n--- Test 3: buildPromptFromTemplate ---');
        var templateTypes = ['compliance_review', 'risk_assessment', 'gap_analysis', 'evidence_validation'];
        
        templateTypes.forEach(function(type) {
            var result = promptBuilder.buildPromptFromTemplate(type, testData);
            if (result.success) {
                gs.info('✓ Template type "' + type + '" loaded: ' + result.template_name);
                gs.info('  Temperature: ' + result.temperature + ', Max Tokens: ' + result.max_tokens);
            } else {
                gs.warn('⚠ Template type "' + type + '" not found: ' + result.error);
            }
        });
        
        // Test 4: Test framework-specific template
        gs.info('\n--- Test 4: Framework-specific template ---');
        var soc2Data = Object.assign({}, testData);
        soc2Data.framework = 'soc2';  // Will be converted to soc_2 internally
        var soc2Prompt = promptBuilder.buildCompliancePrompt(soc2Data);
        
        if (soc2Prompt && soc2Prompt.indexOf('SOC') > -1) {
            gs.info('✓ SOC2-specific template loaded');
        } else {
            gs.info('⚠ Using generic template for SOC2 (SOC2 template may not be active)');
        }
        
        // Also test with the actual DB value
        var soc2Data2 = Object.assign({}, testData);
        soc2Data2.framework = 'soc_2';  // Direct DB value
        var soc2Prompt2 = promptBuilder.buildCompliancePrompt(soc2Data2);
        if (soc2Prompt2) {
            gs.info('✓ Direct soc_2 framework value also works');
        }
        
        // Test 5: Test fallback to hardcoded
        gs.info('\n--- Test 5: Fallback mechanism ---');
        var invalidData = {
            controlObjectiveDescription: "Test",
            framework: "non_existent_framework"
        };
        var fallbackPrompt = promptBuilder.buildCompliancePrompt(invalidData);
        
        if (fallbackPrompt && fallbackPrompt.length > 0) {
            gs.info('✓ Fallback to hardcoded prompt working');
        } else {
            gs.error('✗ Fallback mechanism failed');
        }
        
        // Test 6: Check template caching
        gs.info('\n--- Test 6: Template caching ---');
        var start = new Date().getTime();
        for (var i = 0; i < 5; i++) {
            promptBuilder.buildCompliancePrompt(testData);
        }
        var elapsed = new Date().getTime() - start;
        gs.info('5 template loads took ' + elapsed + 'ms (should be fast due to caching)');
        
        gs.info('\n=== Template Testing Complete ===');
        
    } catch (e) {
        gs.error('Test failed with error: ' + e.getMessage());
        gs.error('Stack: ' + e.stack);
    }
})();