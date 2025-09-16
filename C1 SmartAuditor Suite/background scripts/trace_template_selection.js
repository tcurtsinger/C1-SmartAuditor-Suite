/**
 * Trace exact template selection logic
 */

(function traceTemplateSelection() {
    gs.info('=== Tracing Template Selection Logic ===\n');
    
    // Simulate exactly what happens in PromptBuilder._getTemplate()
    var templateType = 'compliance_review';
    var framework = 'nist';
    
    gs.info('Input: templateType="' + templateType + '", framework="' + framework + '"');
    
    // Check cache key
    var cacheKey = templateType + '_' + (framework || 'generic');
    gs.info('Cache key: "' + cacheKey + '"');
    
    gs.info('\n--- Simulating PromptBuilder._getTemplate() logic ---');
    
    var gr = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr.addQuery('active', true);
    gr.addQuery('template_type', templateType);
    
    // This is the exact logic from PromptBuilder
    if (framework && framework !== 'generic') {
        gs.info('Framework is not generic, using IN clause');
        
        // Check if framework needs conversion
        var dbFramework = framework;
        if (framework === 'soc2') dbFramework = 'soc_2';
        else if (framework === 'iso27001') dbFramework = 'iso_27001';
        else if (framework === 'pci' || framework === 'pcidss') dbFramework = 'pci_dss';
        
        gs.info('Converted framework: "' + framework + '" → "' + dbFramework + '"');
        gs.info('Query: framework IN "' + dbFramework + ',generic"');
        
        gr.addQuery('framework', 'IN', dbFramework + ',generic');
        gr.orderByDesc('framework');  // This should put nist before generic
        gs.info('Ordering: framework DESC (should put nist first)');
    } else {
        gs.info('Framework is generic or empty');
        gr.addQuery('framework', 'generic');
    }
    
    gr.orderBy('priority');
    gs.info('Then ordering by: priority ASC');
    
    gr.setLimit(1);
    gr.query();
    
    if (gr.next()) {
        gs.info('\nSELECTED TEMPLATE:');
        gs.info('  Name: ' + gr.getValue('name'));
        gs.info('  Framework: ' + gr.getValue('framework'));
        gs.info('  Priority: ' + gr.getValue('priority'));
    } else {
        gs.error('NO TEMPLATE FOUND!');
    }
    
    // Now let's check what happens with the actual alphabetical comparison
    gs.info('\n--- Checking alphabetical ordering ---');
    var frameworks = ['nist', 'generic', 'cis', 'soc_2', 'csa_ccm'];
    frameworks.sort();
    gs.info('Ascending sort: ' + frameworks.join(', '));
    
    frameworks.sort(function(a, b) {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
    });
    gs.info('Descending sort: ' + frameworks.join(', '));
    
    // Test query without setLimit to see all results
    gs.info('\n--- All results without limit ---');
    var gr2 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr2.addQuery('active', true);
    gr2.addQuery('template_type', 'compliance_review');
    gr2.addQuery('framework', 'IN', 'nist,generic');
    gr2.orderByDesc('framework');
    gr2.orderBy('priority');
    gr2.query();
    
    var count = 0;
    while (gr2.next()) {
        count++;
        gs.info(count + '. ' + gr2.getValue('name') + ' (framework: ' + gr2.getValue('framework') + ', priority: ' + gr2.getValue('priority') + ')');
    }
    
    gs.info('\n=== Trace Complete ===');
})();