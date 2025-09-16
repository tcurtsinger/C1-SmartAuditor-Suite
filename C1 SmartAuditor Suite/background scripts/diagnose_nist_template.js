/**
 * Diagnose why NIST template isn't being selected
 */

(function diagnoseNISTTemplate() {
    gs.info('=== Diagnosing NIST Template Selection ===\n');
    
    // Check what templates exist for compliance_review
    gs.info('All compliance_review templates:');
    var gr = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr.addQuery('template_type', 'compliance_review');
    gr.addQuery('active', true);
    gr.orderBy('framework');
    gr.orderBy('priority');
    gr.query();
    
    while (gr.next()) {
        gs.info('  ' + gr.getValue('name') + 
               ' | Framework: ' + gr.getValue('framework') +
               ' | Priority: ' + gr.getValue('priority') +
               ' | Active: ' + gr.getValue('active'));
    }
    
    gs.info('\n--- Testing NIST framework query ---');
    
    // Test the exact query that PromptBuilder would use for NIST
    var gr2 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr2.addQuery('active', true);
    gr2.addQuery('template_type', 'compliance_review');
    gr2.addQuery('framework', 'IN', 'nist,generic');
    gr2.orderByDesc('framework');  // nist should come before generic
    gr2.orderBy('priority');  // then by priority
    gr2.query();
    
    gs.info('Templates matching "nist,generic" with ordering:');
    var count = 0;
    while (gr2.next() && count < 5) {
        count++;
        gs.info('  ' + count + '. ' + gr2.getValue('name') + 
               ' | Framework: ' + gr2.getValue('framework') +
               ' | Priority: ' + gr2.getValue('priority'));
    }
    
    // Now test with setLimit(1) like the actual code
    gs.info('\n--- With setLimit(1) (what actually gets selected) ---');
    var gr3 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr3.addQuery('active', true);
    gr3.addQuery('template_type', 'compliance_review');
    gr3.addQuery('framework', 'IN', 'nist,generic');
    gr3.orderByDesc('framework');
    gr3.orderBy('priority');
    gr3.setLimit(1);
    gr3.query();
    
    if (gr3.next()) {
        gs.info('SELECTED: ' + gr3.getValue('name') + 
               ' | Framework: ' + gr3.getValue('framework') +
               ' | Priority: ' + gr3.getValue('priority'));
    }
    
    // Check alphabetical ordering
    gs.info('\n--- Alphabetical check ---');
    gs.info('generic < nist: ' + ('generic' < 'nist'));  // true
    gs.info('nist > generic: ' + ('nist' > 'generic'));  // true
    gs.info('With DESC ordering, nist should come first');
    
    gs.info('\n=== Diagnosis Complete ===');
})();