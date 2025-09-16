/**
 * Diagnostic Script for Template Selection
 * Run this in Scripts - Background to diagnose why SOC2 template isn't being selected
 */

(function diagnoseTemplateSelection() {
    gs.info('=== Diagnosing Template Selection ===\n');
    
    // First, let's see what templates exist in the database
    gs.info('--- All Templates in Database ---');
    var gr = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr.orderBy('template_type');
    gr.orderBy('framework');
    gr.orderBy('priority');
    gr.query();
    
    var templateCount = 0;
    while (gr.next()) {
        templateCount++;
        gs.info('Template #' + templateCount + ':');
        gs.info('  Name: ' + gr.getValue('name'));
        gs.info('  Type: ' + gr.getValue('template_type'));
        gs.info('  Framework: ' + gr.getValue('framework'));
        gs.info('  Priority: ' + gr.getValue('priority'));
        gs.info('  Active: ' + gr.getValue('active'));
        gs.info('  ---');
    }
    
    gs.info('Total templates found: ' + templateCount);
    
    // Now test the specific query for SOC2
    gs.info('\n--- Testing SOC2 Template Selection ---');
    
    // Test 1: Direct query for soc_2 framework
    gs.info('\nTest 1: Direct query for framework="soc_2" and type="compliance_review"');
    var gr1 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr1.addQuery('active', true);
    gr1.addQuery('template_type', 'compliance_review');
    gr1.addQuery('framework', 'soc_2');
    gr1.query();
    
    if (gr1.next()) {
        gs.info('✓ Found SOC2 template: ' + gr1.getValue('name'));
    } else {
        gs.error('✗ No SOC2 template found with framework="soc_2"');
    }
    
    // Test 2: Query with IN clause (like the actual code)
    gs.info('\nTest 2: Query with IN clause for frameworks');
    var gr2 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr2.addQuery('active', true);
    gr2.addQuery('template_type', 'compliance_review');
    gr2.addQuery('framework', 'IN', 'soc_2,generic');
    gr2.orderBy('framework'); // soc_2 should come before generic
    gr2.orderByDesc('priority');
    gr2.query();
    
    gs.info('Templates found with IN clause:');
    var count = 0;
    while (gr2.next() && count < 3) {
        count++;
        gs.info('  ' + count + '. ' + gr2.getValue('name') + 
               ' (framework: ' + gr2.getValue('framework') + 
               ', priority: ' + gr2.getValue('priority') + ')');
    }
    
    // Test 3: What the PromptBuilder actually does
    gs.info('\n--- Testing PromptBuilder Logic ---');
    
    var testFrameworks = ['soc2', 'soc_2', 'generic'];
    var promptBuilder = new PromptBuilder();
    
    testFrameworks.forEach(function(fw) {
        gs.info('\nTesting with framework: "' + fw + '"');
        
        // Simulate the _getTemplate logic
        var cacheKey = 'compliance_review_' + fw;
        
        var gr3 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
        gr3.addQuery('active', true);
        gr3.addQuery('template_type', 'compliance_review');
        
        if (fw && fw !== 'generic') {
            var dbFramework = fw;
            // This is the conversion logic from PromptBuilder
            if (fw === 'soc2') dbFramework = 'soc_2';
            else if (fw === 'iso27001') dbFramework = 'iso_27001';
            else if (fw === 'pci' || fw === 'pcidss') dbFramework = 'pci_dss';
            
            gs.info('  Converted framework: "' + fw + '" → "' + dbFramework + '"');
            gr3.addQuery('framework', 'IN', dbFramework + ',generic');
            gr3.orderBy('framework');
        } else {
            gr3.addQuery('framework', 'generic');
        }
        
        gr3.orderByDesc('priority');
        gr3.setLimit(1);
        gr3.query();
        
        if (gr3.next()) {
            gs.info('  Result: Selected template "' + gr3.getValue('name') + 
                   '" (framework: ' + gr3.getValue('framework') + ')');
        } else {
            gs.info('  Result: No template found');
        }
    });
    
    // Test 4: Check the actual orderBy behavior
    gs.info('\n--- Testing OrderBy Behavior ---');
    var gr4 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr4.addQuery('active', true);
    gr4.addQuery('template_type', 'compliance_review');
    gr4.addQuery('framework', 'IN', 'soc_2,generic');
    
    // The issue might be here - let's test different ordering
    gs.info('\nTest with framework DESC ordering (soc_2 should come first):');
    gr4.orderByDesc('framework'); // soc_2 > generic alphabetically
    gr4.orderByDesc('priority');
    gr4.query();
    
    count = 0;
    while (gr4.next() && count < 3) {
        count++;
        gs.info('  ' + count + '. ' + gr4.getValue('name') + 
               ' (framework: ' + gr4.getValue('framework') + 
               ', priority: ' + gr4.getValue('priority') + ')');
    }
    
    gs.info('\n=== Diagnosis Complete ===');
    
})();