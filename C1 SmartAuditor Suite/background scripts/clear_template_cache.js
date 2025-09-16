/**
 * Clear the template cache and test NIST template selection
 */

(function clearTemplateCacheAndTest() {
    gs.info('=== Clearing Template Cache ===\n');
    
    // Create a new PromptBuilder instance (fresh cache)
    var promptBuilder = new PromptBuilder();
    
    // Clear the cache by setting it to empty object
    promptBuilder.templateCache = {};
    gs.info('Template cache cleared');
    
    // Now test with NIST framework
    gs.info('\n--- Testing NIST Template Selection (Fresh Cache) ---');
    
    var testData = {
        controlObjectiveDescription: "Test NIST control objective",
        supplementalGuidance: "Test guidance",
        attestationResponse: "Test response",
        controlNumber: "AC-1",
        controlReference: "NIST 800-53",
        controlName: "Access Control Policy",
        framework: "nist"
    };
    
    // This should now select the NIST template
    var result = promptBuilder.buildPromptFromTemplate('compliance_review', testData);
    
    if (result.success) {
        gs.info('✓ Template selected: ' + result.template_name);
        gs.info('  Temperature: ' + result.temperature);
        gs.info('  Max Tokens: ' + result.max_tokens);
        
        // Check if it's the NIST template
        if (result.template_name === 'compliance_review_nist') {
            gs.info('\n✅ SUCCESS: NIST template is now being selected!');
        } else {
            gs.warn('\n⚠ Still using: ' + result.template_name);
        }
    } else {
        gs.error('✗ Template selection failed: ' + result.error);
    }
    
    // Test with CIS framework
    gs.info('\n--- Testing CIS Template Selection ---');
    testData.framework = 'cis';
    result = promptBuilder.buildPromptFromTemplate('compliance_review', testData);
    if (result.success) {
        gs.info('✓ CIS Template selected: ' + result.template_name);
    }
    
    // Test with CSA framework
    gs.info('\n--- Testing CSA Template Selection ---');
    testData.framework = 'csa_ccm';
    result = promptBuilder.buildPromptFromTemplate('compliance_review', testData);
    if (result.success) {
        gs.info('✓ CSA Template selected: ' + result.template_name);
    }
    
    gs.info('\n=== Cache Test Complete ===');
    gs.info('Note: The cache is per PromptBuilder instance.');
    gs.info('In production, each script execution creates a new instance with empty cache.');
})();