# C1 SmartAuditor Suite - Troubleshooting Guide

## Quick Diagnosis Checklist

Before diving into specific issues, verify these critical items:

- [ ] OnAttestationSubmitPP Business Rule is set to **Async**
- [ ] LLM Configuration record is **enabled**
- [ ] API key is valid and not expired
- [ ] Attestation has `sn_grc_item` populated
- [ ] System properties are enabled

---

## Common Issues and Solutions

### 1. "Illegal access to outbound HTTP" Error

**Symptoms:**
- Error in logs: "Illegal access to outbound HTTP in C1 SmartAuditor Suite"
- No Review Analysis records created
- Business Rule fails to execute

**Root Cause:**
OnAttestationSubmitPP Business Rule is not set to Async mode

**Solution:**
1. Navigate to: System Definition > Business Rules
2. Search for: `OnAttestationSubmitPP`
3. Open the Business Rule
4. Change "When" field to: **Async**
5. Save the record

**Verification:**
```javascript
// Run in Scripts - Background
var br = new GlideRecord('sys_script');
br.addQuery('name', 'OnAttestationSubmitPP');
br.query();
if (br.next()) {
    gs.info('Business Rule When: ' + br.when);
    // Should output: "async"
}
```

---

### 2. No Review Analysis Records Created

**Symptoms:**
- Attestation completes but no review happens
- x_n1ll2_c1_smart_6_review_analysis table is empty
- No work notes on attestation

**Possible Causes & Solutions:**

#### A. Missing sn_grc_item
**Check:**
```javascript
var att = new GlideRecord('asmt_assessment_instance');
att.get('YOUR_ATTESTATION_SYS_ID');
gs.info('sn_grc_item: ' + att.sn_grc_item);
```

**Solution:**
Ensure attestation is for a GRC control with sn_grc_item populated

#### B. System Properties Disabled
**Check:**
```javascript
gs.info('Auto Review: ' + gs.getProperty('x_n1ll2_c1_smart_6.llm.enable_auto_review'));
gs.info('Auto Actions: ' + gs.getProperty('x_n1ll2_c1_smart_6.llm.enable_auto_actions'));
```

**Solution:**
Set both properties to 'true'

#### C. LLM Configuration Disabled
**Check:**
```javascript
var config = new GlideRecord('x_n1ll2_c1_smart_6_llm_config');
config.addQuery('enabled', true);
config.query();
gs.info('Active configs: ' + config.getRowCount());
```

**Solution:**
Enable at least one LLM configuration record

---

### 3. "The undefined value has no properties" Error

**Symptoms:**
- Error at line containing `current.metric.getRefRecord()`
- Business Rule fails to execute

**Root Cause:**
Business Rules were checking for `current.metric` which doesn't exist

**Solution:**
Already fixed in Version 2.0 - Business Rules now check `sn_grc_item` instead

**Verification:**
Ensure you're using the latest Business Rule versions that check:
```javascript
if (!current.sn_grc_item) {
    return; // Not a GRC attestation
}
```

---

### 4. Work Notes Not Appearing on Control

**Symptoms:**
- Review completes successfully
- No comments visible on Control record
- Processing appears successful in logs

**Root Cause:**
sn_compliance_control table uses `comments` field, not `work_notes`

**Solution:**
Already fixed in Version 2.0 - ProcessReviewResults uses `comments` field

**Verification:**
```javascript
// Check if comments field exists
var dict = new GlideRecord('sys_dictionary');
dict.addQuery('name', 'sn_compliance_control');
dict.addQuery('element', 'comments');
dict.query();
gs.info('Comments field exists: ' + dict.hasNext());
```

---

### 5. Control Not Changing States

**Symptoms:**
- Review completes but Control stays in same state
- Status field not updating
- State transitions not happening

**Possible Causes & Solutions:**

#### A. Invalid State Values
**Check:**
```javascript
var choice = new GlideRecord('sys_choice');
choice.addQuery('name', 'sn_compliance_control');
choice.addQuery('element', 'state');
choice.query();
while (choice.next()) {
    gs.info('State: ' + choice.value + ' (' + choice.label + ')');
}
```

**Expected Values:**
- draft
- attest
- review
- monitor

#### B. Missing Status Field
**Check:**
```javascript
var control = new GlideRecord('sn_compliance_control');
control.setLimit(1);
control.query();
if (control.next()) {
    gs.info('Status value: ' + control.getValue('status'));
}
```

---

### 6. Duplicate "REV" in Work Notes

**Symptoms:**
- Work notes show "Review Analysis: REVREV0001008"
- Link text has duplicate prefix

**Root Cause:**
Code was concatenating "REV" with number field that already contained "REV"

**Solution:**
Already fixed in Version 2.0 - removed duplicate prefix

**Current Format:**
```javascript
workNote += 'Review Analysis: [code]<a href="...">]' + analysisGr.number + '</a>[/code]\n';
```

---

### 7. Attestation State Incorrectly Changed

**Symptoms:**
- Completed attestation changes back to in_progress
- Multiple attestations for same control
- Confusing state changes

**Root Cause:**
System was changing attestation state for non-compliance

**Solution:**
Fixed in Version 2.0 - attestation stays complete, new one generated

**Behavior:**
- NON-COMPLIANT: Attestation stays complete, Control moves to attest
- ServiceNow generates new attestation automatically

---

### 8. API Connection Failures

**Symptoms:**
- "Connection timeout" errors
- "401 Unauthorized" errors
- "Rate limit exceeded" errors

**Solutions:**

#### A. Invalid API Key
**Test:**
```javascript
var connector = new LLMConnector();
var result = connector.sendPrompt('Test prompt', {});
gs.info('Success: ' + result.success);
if (!result.success) {
    gs.error('Error: ' + result.error);
}
```

**Fix:** Update API key in LLM Configuration

#### B. Rate Limiting
**Fix:** Implement throttling or upgrade API plan

#### C. Network Issues
**Check:** Verify ServiceNow instance can reach external APIs

---

### 9. Poor AI Analysis Quality

**Symptoms:**
- Incorrect compliance assessments
- Inconsistent risk scores
- Missing gaps or recommendations

**Solutions:**

#### A. Adjust Temperature
Lower temperature (0.1-0.3) for more consistent results

#### B. Improve Prompts
Edit PromptBuilder to provide clearer instructions

#### C. Check Supplemental Guidance
Ensure Control records have supplemental_guidance populated

---

### 10. Processing Takes Too Long

**Symptoms:**
- Reviews take > 10 seconds
- Timeouts occurring
- User experience impacted

**Solutions:**

#### A. Check API Response Time
Monitor processing_time_ms in review_analysis records

#### B. Reduce Max Tokens
Lower max_tokens in LLM Configuration (minimum 1000)

#### C. Use Faster Model
Switch to a faster model (e.g., gemini-pro vs gpt-4)

---

## Diagnostic Scripts

### 1. System Health Check
```javascript
// Run complete system health check
gs.info('=== C1 SmartAuditor Suite Health Check ===');

// Check Business Rules
var br = new GlideRecord('sys_script');
br.addQuery('name', 'IN', 'ValidateAttestationBeforeComplete,OnAttestationSubmitPP,ProcessReviewResults');
br.query();
while (br.next()) {
    gs.info(br.name + ': Active=' + br.active + ', When=' + br.when);
}

// Check LLM Config
var config = new GlideRecord('x_n1ll2_c1_smart_6_llm_config');
config.addQuery('enabled', true);
config.query();
gs.info('Active LLM Configs: ' + config.getRowCount());

// Check System Properties
gs.info('Auto Review: ' + gs.getProperty('x_n1ll2_c1_smart_6.llm.enable_auto_review'));
gs.info('Auto Actions: ' + gs.getProperty('x_n1ll2_c1_smart_6.llm.enable_auto_actions'));
gs.info('Threshold: ' + gs.getProperty('x_n1ll2_c1_smart_6.llm.auto_approve_threshold'));

// Check Recent Reviews
var review = new GlideRecord('x_n1ll2_c1_smart_6_review_analysis');
review.orderByDesc('sys_created_on');
review.setLimit(5);
review.query();
gs.info('Recent Reviews: ' + review.getRowCount());
```

### 2. Test Specific Attestation
```javascript
// Test review for specific attestation
var attestationId = 'YOUR_ATTESTATION_SYS_ID';
var api = new SmartAttestationReviewAPI();
var result = api.reviewAttestation(attestationId);

if (result.success) {
    gs.info('✅ Review successful');
    gs.info('Status: ' + result.analysis.compliance_status);
    gs.info('Risk: ' + result.analysis.risk_score);
    gs.info('Record: ' + result.reviewRecordId);
} else {
    gs.error('❌ Review failed: ' + result.error);
}
```

### 3. Force Reprocess Attestation
```javascript
// Reprocess an attestation that already has a review
var attestationId = 'YOUR_ATTESTATION_SYS_ID';

// Delete existing review
var existing = new GlideRecord('x_n1ll2_c1_smart_6_review_analysis');
existing.addQuery('attestation', attestationId);
existing.deleteMultiple();

// Run new review
var api = new SmartAttestationReviewAPI();
var result = api.reviewAttestation(attestationId);
gs.info('Reprocessed: ' + result.success);
```

---

## Log Analysis

### Key Log Patterns to Search

| Pattern | Meaning |
|---------|---------|
| "SmartAttestation Review:" | General operations |
| "LLMConnector:" | API communications |
| "ComplianceAnalyzer:" | Response parsing |
| "ProcessReviewResults:" | Action execution |
| "HTTP 401" | Authentication failure |
| "HTTP 429" | Rate limiting |
| "Connection timeout" | Network issues |

### Useful Log Queries

```javascript
// Find all SmartAttestation errors in last 24 hours
var gr = new GlideRecord('syslog');
gr.addQuery('message', 'CONTAINS', 'SmartAttestation');
gr.addQuery('level', 'error');
gr.addQuery('sys_created_on', '>', gs.daysAgoStart(1));
gr.query();
while (gr.next()) {
    gs.info(gr.sys_created_on + ': ' + gr.message);
}
```

---

## Emergency Procedures

### Disable All Processing
```javascript
// Emergency stop
gs.setProperty('x_n1ll2_c1_smart_6.llm.enable_auto_review', 'false');
gs.setProperty('x_n1ll2_c1_smart_6.llm.enable_auto_actions', 'false');
```

### Re-enable Processing
```javascript
// Resume operations
gs.setProperty('x_n1ll2_c1_smart_6.llm.enable_auto_review', 'true');
gs.setProperty('x_n1ll2_c1_smart_6.llm.enable_auto_actions', 'true');
```

### Rollback Changes
If issues occur after deployment:
1. Deactivate the three Business Rules
2. Disable LLM configuration
3. Review error logs
4. Fix issues
5. Re-enable components one by one

---

## Performance Tuning

### Optimize Response Time
1. Reduce max_tokens to minimum needed (1000-1500)
2. Lower temperature to 0.2-0.3
3. Use faster models (gemini-pro vs gpt-4)
4. Enable caching if available

### Reduce Costs
1. Minimize prompt length
2. Lower max_tokens
3. Use cheaper models for low-risk attestations
4. Implement daily/monthly limits

---

## Getting Help

### Internal Resources
1. Check System Logs
2. Review this troubleshooting guide
3. Run diagnostic scripts
4. Check Implementation_Progress.md

### External Resources
1. ServiceNow Community
2. LLM Provider documentation
3. ServiceNow official documentation

### Escalation Path
1. Level 1: Check this guide and logs
2. Level 2: Run diagnostic scripts
3. Level 3: Review code and configuration
4. Level 4: Contact ServiceNow support

---

*Last Updated: August 2024*
*Version: 2.0*