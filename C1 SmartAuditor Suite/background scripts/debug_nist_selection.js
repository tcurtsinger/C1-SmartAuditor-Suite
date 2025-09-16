/**
 * Debug NIST template selection with detailed logging
 */

(function debugNISTSelection() {
    gs.info('=== Debugging NIST Template Selection ===\n');
    
    // Create a modified version of _getTemplate with extra logging
    function debugGetTemplate(templateType, framework) {
        gs.info('debugGetTemplate called with:');
        gs.info('  templateType: "' + templateType + '"');
        gs.info('  framework: "' + framework + '"');
        
        // Check cache first
        var cacheKey = templateType + '_' + (framework || 'generic');
        gs.info('  cacheKey: "' + cacheKey + '"');
        
        var gr = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
        gr.addQuery('active', true);
        gr.addQuery('template_type', templateType);
        
        // Try framework-specific first, then generic
        if (framework && framework !== 'generic') {
            gs.info('  Framework is not generic, checking for conversion...');
            
            // Convert framework to match database values if needed
            var dbFramework = framework;
            if (framework === 'soc2') {
                dbFramework = 'soc_2';
                gs.info('  Converted soc2 to soc_2');
            }
            else if (framework === 'iso27001') {
                dbFramework = 'iso_27001';
                gs.info('  Converted iso27001 to iso_27001');
            }
            else if (framework === 'pci' || framework === 'pcidss') {
                dbFramework = 'pci_dss';
                gs.info('  Converted to pci_dss');
            } else {
                gs.info('  No conversion needed for "' + framework + '"');
            }
            
            gs.info('  Adding query: framework IN "' + dbFramework + ',generic"');
            gr.addQuery('framework', 'IN', dbFramework + ',generic');
            
            gs.info('  Adding orderByDesc(framework)');
            gr.orderByDesc('framework');
        } else {
            gs.info('  Framework is generic or empty');
            gr.addQuery('framework', 'generic');
        }
        
        gs.info('  Adding orderBy(priority)');
        gr.orderBy('priority');
        
        gs.info('  Setting limit to 1');
        gr.setLimit(1);
        
        gs.info('  Executing query...');
        gr.query();
        
        if (gr.next()) {
            var template = {
                name: gr.getValue('name'),
                prompt_text: gr.getValue('prompt_text'),
                variables: gr.getValue('variables'),
                temperature: parseFloat(gr.getValue('temperature')) || 0.3,
                max_tokens: parseInt(gr.getValue('max_tokens')) || 2000
            };
            
            gs.info('  FOUND TEMPLATE: ' + template.name);
            return template;
        }
        
        gs.info('  NO TEMPLATE FOUND');
        return null;
    }
    
    // Test with NIST
    gs.info('\n--- Testing NIST ---');
    var nistTemplate = debugGetTemplate('compliance_review', 'nist');
    if (nistTemplate) {
        gs.info('Result: ' + nistTemplate.name);
    }
    
    // Test with CIS for comparison
    gs.info('\n--- Testing CIS ---');
    var cisTemplate = debugGetTemplate('compliance_review', 'cis');
    if (cisTemplate) {
        gs.info('Result: ' + cisTemplate.name);
    }
    
    // Now let's check if there's something wrong with the NIST template record itself
    gs.info('\n--- Checking NIST Template Record ---');
    var gr = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr.addQuery('name', 'compliance_review_nist');
    gr.query();
    
    if (gr.next()) {
        gs.info('NIST Template found:');
        gs.info('  sys_id: ' + gr.getUniqueValue());
        gs.info('  name: ' + gr.getValue('name'));
        gs.info('  template_type: ' + gr.getValue('template_type'));
        gs.info('  framework: "' + gr.getValue('framework') + '" (length: ' + gr.getValue('framework').length + ')');
        gs.info('  priority: ' + gr.getValue('priority'));
        gs.info('  active: ' + gr.getValue('active'));
        
        // Check for hidden characters
        var framework = gr.getValue('framework');
        gs.info('  framework char codes: ');
        for (var i = 0; i < framework.length; i++) {
            gs.info('    [' + i + ']: "' + framework.charAt(i) + '" = ' + framework.charCodeAt(i));
        }
        
        // Check if it matches exactly
        gs.info('  framework === "nist": ' + (framework === 'nist'));
        gs.info('  framework == "nist": ' + (framework == 'nist'));
        gs.info('  framework.trim() === "nist": ' + (framework.trim() === 'nist'));
    } else {
        gs.error('NIST Template NOT FOUND!');
    }
    
    gs.info('\n=== Debug Complete ===');
})();