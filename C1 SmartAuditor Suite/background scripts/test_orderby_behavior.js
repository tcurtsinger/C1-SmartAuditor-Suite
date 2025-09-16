/**
 * Test ServiceNow's orderBy behavior with framework values
 */

(function testOrderByBehavior() {
    gs.info('=== Testing ServiceNow OrderBy Behavior ===\n');
    
    // Test 1: Just framework ordering
    gs.info('Test 1: Order by framework DESC only');
    var gr1 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr1.addQuery('template_type', 'compliance_review');
    gr1.addQuery('framework', 'IN', 'nist,generic');
    gr1.orderByDesc('framework');
    gr1.query();
    
    while (gr1.next()) {
        gs.info('  ' + gr1.getValue('name') + ' | Framework: ' + gr1.getValue('framework'));
    }
    
    // Test 2: Framework DESC then priority ASC
    gs.info('\nTest 2: Order by framework DESC, then priority ASC');
    var gr2 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr2.addQuery('template_type', 'compliance_review');
    gr2.addQuery('framework', 'IN', 'nist,generic');
    gr2.orderByDesc('framework');
    gr2.orderBy('priority');
    gr2.query();
    
    while (gr2.next()) {
        gs.info('  ' + gr2.getValue('name') + ' | Framework: ' + gr2.getValue('framework') + ' | Priority: ' + gr2.getValue('priority'));
    }
    
    // Test 3: Priority first, then framework
    gs.info('\nTest 3: Order by priority ASC, then framework DESC');
    var gr3 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr3.addQuery('template_type', 'compliance_review');
    gr3.addQuery('framework', 'IN', 'nist,generic');
    gr3.orderBy('priority');
    gr3.orderByDesc('framework');
    gr3.query();
    
    while (gr3.next()) {
        gs.info('  ' + gr3.getValue('name') + ' | Framework: ' + gr3.getValue('framework') + ' | Priority: ' + gr3.getValue('priority'));
    }
    
    // Test 4: What if we use addOrderBy instead
    gs.info('\nTest 4: Using addOrderBy method');
    var gr4 = new GlideRecord('x_n1ll2_c1_smart_6_prompt_templates');
    gr4.addQuery('template_type', 'compliance_review');  
    gr4.addQuery('framework', 'IN', 'nist,generic');
    gr4.addOrderBy('framework DESC');
    gr4.addOrderBy('priority');
    gr4.query();
    
    while (gr4.next()) {
        gs.info('  ' + gr4.getValue('name') + ' | Framework: ' + gr4.getValue('framework') + ' | Priority: ' + gr4.getValue('priority'));
    }
    
    gs.info('\n=== OrderBy Test Complete ===');
})();