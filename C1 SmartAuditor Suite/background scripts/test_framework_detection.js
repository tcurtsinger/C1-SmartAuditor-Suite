/**
 * Test Framework Detection from Source Field
 * Run this in Scripts - Background to test framework normalization
 */

(function testFrameworkDetection() {
    gs.info('=== Testing Framework Detection ===\n');
    
    // We can't call private methods, so let's test the normalization logic
    function normalizeFramework(source) {
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
            return 'cis';  // Now returns 'cis' framework
        }
        // CSA CCM
        else if (normalized.indexOf('csa') > -1 || normalized.indexOf('ccm') > -1) {
            return 'csa_ccm';  // Now returns 'csa_ccm' framework
        }
        
        return 'generic';
    }
    
    var testSources = [
        'NIST 800-53-r4',
        'NIST 800-53-r5',
        'NIST CSF',
        'NIST CSF v2.0',
        'SOC 2',
        'SOC2',
        'ISO 27001',
        'ISO27001',
        'HIPAA',
        'PCI DSS',
        'PCI-DSS',
        'CIS',
        'CIS V8',
        'CSA CCM V4',
        'Unknown Framework',
        '',
        null
    ];
    
    gs.info('Testing source normalization:');
    gs.info('------------------------------');
    
    testSources.forEach(function(source) {
        var normalized = normalizeFramework(source);
        gs.info('Source: "' + source + '" → Framework: "' + normalized + '"');
    });
    
    gs.info('\n=== Testing with Real Control Objectives ===\n');
    
    // Query some actual control objectives to see their sources
    var gr = new GlideRecord('sn_compliance_policy_statement');
    gr.addQuery('source', '!=', '');
    gr.setLimit(10);
    gr.query();
    
    gs.info('Sample Control Objectives:');
    gs.info('-------------------------');
    
    while (gr.next()) {
        var source = gr.getValue('source');
        var normalized = normalizeFramework(source);
        
        gs.info('CO: ' + gr.getValue('reference') + ' | ' + gr.getValue('name'));
        gs.info('  Source: "' + source + '"');
        gs.info('  Normalized Framework: "' + normalized + '"');
        
        // Check if we have a template for this framework
        var pb = new PromptBuilder();
        var testData = {
            framework: normalized,
            controlObjectiveDescription: 'test',
            attestationResponse: 'test',
            supplementalGuidance: 'test'
        };
        
        var result = pb.buildPromptFromTemplate('compliance_review', testData);
        if (result.success) {
            gs.info('  ✓ Template found: ' + result.template_name);
        } else {
            gs.info('  ⚠ No specific template (will use generic)');
        }
        gs.info('');
    }
    
    gs.info('\n=== Framework Detection Complete ===');
})();