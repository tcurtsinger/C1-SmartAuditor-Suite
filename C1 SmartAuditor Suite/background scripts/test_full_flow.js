/**
 * Test the full flow from data gathering to template selection
 */

(function testFullFlow() {
    gs.info('=== Testing Full Template Selection Flow ===\n');
    
    // Simulate what SmartAttestationReviewAPI does
    gs.info('Step 1: Simulating data from a NIST Control Objective');
    
    // This simulates the _normalizeFramework function
    function normalizeFramework(source) {
        if (!source) return 'generic';
        
        var normalized = source.toLowerCase();
        
        if (normalized.indexOf('nist') > -1) {
            return 'nist';
        }
        else if (normalized.indexOf('soc 2') > -1 || normalized.indexOf('soc2') > -1) {
            return 'soc_2';
        }
        else if (normalized.indexOf('cis') > -1) {
            return 'cis';
        }
        else if (normalized.indexOf('csa') > -1 || normalized.indexOf('ccm') > -1) {
            return 'csa_ccm';
        }
        
        return 'generic';
    }
    
    // Test with actual Control Objective source values
    var testCases = [
        { source: 'NIST 800-53-r5', expectedFramework: 'nist' },
        { source: 'CIS V8', expectedFramework: 'cis' },
        { source: 'CSA CCM V4', expectedFramework: 'csa_ccm' }
    ];
    
    testCases.forEach(function(testCase) {
        gs.info('\n--- Testing source: "' + testCase.source + '" ---');
        
        // Step 1: Normalize the source
        var normalizedFramework = normalizeFramework(testCase.source);
        gs.info('Normalized framework: "' + normalizedFramework + '"');
        
        if (normalizedFramework !== testCase.expectedFramework) {
            gs.error('ERROR: Expected "' + testCase.expectedFramework + '" but got "' + normalizedFramework + '"');
            return;
        }
        
        // Step 2: Build promptData like SmartAttestationReviewAPI does
        var promptData = {
            controlObjectiveDescription: 'Test control objective',
            supplementalGuidance: 'Test guidance',
            attestationResponse: 'Test response',
            controlNumber: 'TEST-1',
            controlReference: testCase.source,
            controlName: 'Test Control',
            controlSource: testCase.source,
            controlParent: 'Test Parent',
            framework: normalizedFramework  // This is what gets passed
        };
        
        gs.info('PromptData.framework: "' + promptData.framework + '"');
        
        // Step 3: Call buildStructuredPrompt like SmartAttestationReviewAPI does
        var promptBuilder = new PromptBuilder();
        
        // First test buildStructuredPrompt (what SmartAttestationReviewAPI actually calls)
        gs.info('\nCalling buildStructuredPrompt():');
        var prompt = promptBuilder.buildStructuredPrompt(promptData);
        
        // Check which template was used by looking for framework-specific text
        if (normalizedFramework === 'nist' && prompt.indexOf('NIST') > -1) {
            gs.info('✓ NIST-specific content detected in prompt');
        } else if (normalizedFramework === 'cis' && prompt.indexOf('CIS') > -1) {
            gs.info('✓ CIS-specific content detected in prompt');
        } else if (normalizedFramework === 'csa_ccm' && prompt.indexOf('CSA') > -1) {
            gs.info('✓ CSA-specific content detected in prompt');
        } else {
            gs.info('⚠ Generic template appears to be used');
        }
        
        // Also test buildPromptFromTemplate directly
        gs.info('\nCalling buildPromptFromTemplate():');
        var result = promptBuilder.buildPromptFromTemplate('compliance_review', promptData);
        if (result.success) {
            gs.info('Template selected: ' + result.template_name);
        }
    });
    
    gs.info('\n=== Full Flow Test Complete ===');
})();