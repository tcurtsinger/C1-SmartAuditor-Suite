# C1 SmartAuditor Suite - Deployment Guide

## Pre-Deployment Checklist

Before starting deployment, ensure you have:

- [ ] ServiceNow Admin or Developer role
- [ ] Access to C1 SmartAuditor Suite application scope
- [ ] API key for chosen LLM provider (Google Gemini recommended)
- [ ] Backup of current configuration (if updating)
- [ ] Test environment for validation

---

## Step 1: Deploy Script Includes

Deploy these files in the following order to ensure dependencies are met:

### 1.1 LLMConnector
**File**: `src/Server Development/Script Includes/LLMConnector.script.js`
**Navigation**: System Definition > Script Includes > New

```
Name: LLMConnector
API Name: global.LLMConnector (or scoped)
Application: C1 SmartAuditor Suite
Active: true
```

### 1.2 PromptBuilder
**File**: `src/Server Development/Script Includes/PromptBuilder.script.js`
**Navigation**: System Definition > Script Includes > New

```
Name: PromptBuilder
API Name: global.PromptBuilder (or scoped)
Application: C1 SmartAuditor Suite
Active: true
```

### 1.3 ComplianceAnalyzer
**File**: `src/Server Development/Script Includes/ComplianceAnalyzer.script.js`
**Navigation**: System Definition > Script Includes > New

```
Name: ComplianceAnalyzer
API Name: global.ComplianceAnalyzer (or scoped)
Application: C1 SmartAuditor Suite
Active: true
```

### 1.4 SmartAttestationReviewAPI
**File**: `src/Server Development/Script Includes/SmartAttestationReviewAPI.script.js`
**Navigation**: System Definition > Script Includes > New

```
Name: SmartAttestationReviewAPI
API Name: global.SmartAttestationReviewAPI (or scoped)
Application: C1 SmartAuditor Suite
Active: true
```

---

## Step 2: Deploy Business Rules ⚠️ CRITICAL

### 2.1 ValidateAttestationBeforeComplete
**File**: `src/Server Development/Business Rules/ValidateAttestationBeforeComplete.script.js`
**Navigation**: System Definition > Business Rules > New

```
Name: ValidateAttestationBeforeComplete
Table: asmt_assessment_instance
Application: C1 SmartAuditor Suite
Active: true
Advanced: false
When: Before
Insert: false
Update: true
Delete: false
Query: false
Order: 50
Condition: current.state.changes() && current.state == 'complete' && previous.state != 'complete'
```

### 2.2 OnAttestationSubmitPP ⚠️ MUST BE ASYNC
**File**: `src/Server Development/Business Rules/OnAttestationSubmitPP.script.js`
**Navigation**: System Definition > Business Rules > New

```
Name: OnAttestationSubmitPP
Table: asmt_assessment_instance
Application: C1 SmartAuditor Suite
Active: true
Advanced: false
When: Async ⚠️ CRITICAL - MUST BE ASYNC
Insert: false
Update: true
Delete: false
Query: false
Order: 200
Condition: current.state.changes() && current.state == 'complete'
```

**⚠️ CRITICAL**: This rule MUST be set to "Async" in the When field or you will get "Illegal access to outbound HTTP" errors.

### 2.3 ProcessReviewResults
**File**: `src/Server Development/Business Rules/ProcessReviewResults.script.js`
**Navigation**: System Definition > Business Rules > New

```
Name: ProcessReviewResults
Table: x_n1ll2_c1_smart_6_review_analysis
Application: C1 SmartAuditor Suite
Active: true
Advanced: false
When: After
Insert: true
Update: false
Delete: false
Query: false
Order: 100
Condition: true
```

---

## Step 3: Configure System Properties

**Navigation**: System Properties > All Properties

### Create or Update:

```properties
x_n1ll2_c1_smart_6.llm.enable_auto_review = true
x_n1ll2_c1_smart_6.llm.enable_auto_actions = true
x_n1ll2_c1_smart_6.llm.auto_approve_threshold = 3
```

---

## Step 4: Configure LLM Provider

**Navigation**: C1 SmartAuditor Suite > LLM Configuration

### For Google Gemini (Recommended):

1. Click "New"
2. Fill in:
   ```
   Provider: Google Gemini
   API Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
   API Key: [Your Gemini API Key]
   Model Name: gemini-pro
   Max Tokens: 2000
   Temperature: 0.3
   Enabled: true
   ```
3. Click "Submit"

### For OpenAI:

```
Provider: OpenAI
API Endpoint: https://api.openai.com/v1/chat/completions
API Key: [Your OpenAI API Key]
Model Name: gpt-4
Max Tokens: 2000
Temperature: 0.3
Enabled: true
```

### For Anthropic:

```
Provider: Anthropic
API Endpoint: https://api.anthropic.com/v1/messages
API Key: [Your Anthropic API Key]
Model Name: claude-3-opus-20240229
Max Tokens: 2000
Temperature: 0.3
Enabled: true
```

---

## Step 5: Verify Database Tables

### Check Tables Exist:

**Navigation**: System Definition > Tables

1. Search for: `x_n1ll2_c1_smart_6_llm_config`
   - Should have fields: provider, api_endpoint, api_key, model_name, etc.

2. Search for: `x_n1ll2_c1_smart_6_review_analysis`
   - Should have fields: number, attestation, control, compliance_status, etc.
   - Should have auto-numbering configured (REV prefix)

---

## Step 6: Post-Deployment Validation

### 6.1 Verify Business Rules

Run this script in Scripts - Background:

```javascript
// Check Business Rules configuration
var rules = ['ValidateAttestationBeforeComplete', 'OnAttestationSubmitPP', 'ProcessReviewResults'];
rules.forEach(function(name) {
    var br = new GlideRecord('sys_script');
    br.addQuery('name', name);
    br.query();
    if (br.next()) {
        gs.info(name + ':');
        gs.info('  Active: ' + br.active);
        gs.info('  When: ' + br.when);
        gs.info('  Table: ' + br.collection);
        
        if (name === 'OnAttestationSubmitPP' && br.when !== 'async') {
            gs.error('  ⚠️ WARNING: Must be set to Async!');
        }
    } else {
        gs.error(name + ': NOT FOUND');
    }
});
```

### 6.2 Test LLM Connection

```javascript
// Test LLM connectivity
var connector = new LLMConnector();
var result = connector.sendPrompt('Test connection', {});
if (result.success) {
    gs.info('✅ LLM Connection successful');
    gs.info('Provider: ' + result.provider);
} else {
    gs.error('❌ LLM Connection failed: ' + result.error);
}
```

### 6.3 Test with Sample Attestation

1. Create a test attestation:
   - Navigate to GRC workspace
   - Select a control in "Attest" state
   - Complete the attestation
   - Ensure `sn_grc_item` is populated

2. Monitor results:
   ```javascript
   // Check for review analysis
   var review = new GlideRecord('x_n1ll2_c1_smart_6_review_analysis');
   review.orderByDesc('sys_created_on');
   review.setLimit(1);
   review.query();
   if (review.next()) {
       gs.info('Latest Review:');
       gs.info('  Number: ' + review.number);
       gs.info('  Status: ' + review.compliance_status);
       gs.info('  Risk: ' + review.risk_score);
       gs.info('  Auto-approved: ' + review.auto_approved);
   }
   ```

---

## Step 7: Production Deployment

### 7.1 Update Set Creation (Recommended)

1. Create Update Set in development
2. Include all components:
   - 4 Script Includes
   - 3 Business Rules
   - 2 Tables (if new)
   - 3 System Properties
   - 1+ LLM Configuration records

3. Move Update Set to production
4. Preview and commit

### 7.2 Manual Deployment

If deploying manually, follow Steps 1-6 in production environment

---

## Rollback Procedure

If issues occur after deployment:

### Immediate Rollback:

1. **Disable all processing:**
   ```javascript
   gs.setProperty('x_n1ll2_c1_smart_6.llm.enable_auto_review', 'false');
   gs.setProperty('x_n1ll2_c1_smart_6.llm.enable_auto_actions', 'false');
   ```

2. **Deactivate Business Rules:**
   - Set all three Business Rules to Active = false

3. **Disable LLM Configuration:**
   - Set all LLM config records to Enabled = false

### Full Rollback:

1. Back out Update Set (if used)
2. Or manually delete/deactivate all components
3. Restore previous configuration from backup

---

## Common Deployment Issues

### Issue 1: Scripts Don't Load
**Solution**: Clear cache and reload

### Issue 2: Async Rule Not Working
**Solution**: Verify OnAttestationSubmitPP is set to "Async" not "After"

### Issue 3: Tables Not Found
**Solution**: Ensure you're in correct application scope

### Issue 4: API Key Invalid
**Solution**: Re-enter API key in LLM Configuration

---

## Performance Optimization

After successful deployment:

### 1. Monitor Processing Times
```javascript
// Check average processing time
var gr = new GlideAggregate('x_n1ll2_c1_smart_6_review_analysis');
gr.addAggregate('AVG', 'processing_time_ms');
gr.query();
if (gr.next()) {
    gs.info('Average processing time: ' + gr.getAggregate('AVG', 'processing_time_ms') + 'ms');
}
```

### 2. Adjust Thresholds
Based on initial results, adjust:
- Auto-approval threshold (default: 3)
- Temperature setting (default: 0.3)
- Max tokens (default: 2000)

### 3. Review Logs
Check for any errors or warnings:
```javascript
// Find recent errors
var log = new GlideRecord('syslog');
log.addQuery('source', 'CONTAINS', 'x_n1ll2_c1_smart_6');
log.addQuery('level', 'error');
log.addQuery('sys_created_on', '>', gs.hoursAgo(24));
log.query();
while (log.next()) {
    gs.info(log.sys_created_on + ': ' + log.message);
}
```

---

## Success Criteria

Deployment is successful when:

- [ ] All Business Rules are active
- [ ] OnAttestationSubmitPP is set to Async
- [ ] LLM connection test passes
- [ ] Test attestation creates Review Analysis record
- [ ] Control states update correctly
- [ ] Comments appear on Control records
- [ ] No errors in System Logs

---

## Support

For deployment support:
1. Check TROUBLESHOOTING_GUIDE.md
2. Review System Logs
3. Run diagnostic scripts
4. Contact ServiceNow support if needed

---

*Deployment Guide Version: 2.0*
*Last Updated: August 2024*
*For C1 SmartAuditor Suite Version 2.0*