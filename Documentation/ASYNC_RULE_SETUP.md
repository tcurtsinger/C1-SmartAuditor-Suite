# IMPORTANT: Business Rule Configuration for HTTP Calls

## The Problem
ServiceNow blocks outbound HTTP calls (like calling the LLM API) from synchronous Business Rules for security reasons. This causes the error:
```
Illegal access to outbound HTTP in C1 SmartAuditor Suite. Use an async business rule to perform outbound HTTP requests.
```

## The Solution
The Business Rules have been updated to handle this properly:

### 1. ValidateAttestationBeforeComplete (Before Update Rule)
- **Purpose**: Only checks if a recent review exists
- **HTTP Calls**: None (not allowed in Before rules)
- **Configuration**: Keep as synchronous

### 2. OnAttestationSubmitPP (After Update Rule)
- **Purpose**: Performs the actual LLM review
- **HTTP Calls**: Yes (calls the LLM API)
- **Configuration**: **MUST BE SET TO ASYNC**

## Setup Instructions

### Step 1: Update ValidateAttestationBeforeComplete
1. Navigate to: **System Definition > Business Rules**
2. Search for: `ValidateAttestationBeforeComplete`
3. Open the rule and update the script with the new version
4. Keep it as a synchronous rule (default)
5. Save

### Step 2: Update OnAttestationSubmitPP (CRITICAL)
1. Navigate to: **System Definition > Business Rules**
2. Search for: `OnAttestationSubmitPP`
3. Open the rule and:
   - Update the script with the new version
   - Click the **Advanced** checkbox
   - In the Advanced section, check the **Async** checkbox ✅
   - This allows the rule to make HTTP calls
4. Save

### Step 3: Verify Settings
After saving, verify:
- ValidateAttestationBeforeComplete: Synchronous, Before Update
- OnAttestationSubmitPP: **Async**, After Update

## How It Works Now

1. **User completes attestation** → State changes to "complete"
2. **Before Rule** (ValidateAttestationBeforeComplete):
   - Checks if sn_grc_item is populated
   - Checks if recent review exists
   - Allows transition (no HTTP calls)
3. **After Rule** (OnAttestationSubmitPP) - **Runs Asynchronously**:
   - Makes HTTP call to LLM API
   - Creates review analysis record
   - Updates attestation with results
   - If non-compliant, reverts state to "in_progress"

## Testing
After configuring:
1. Create a new attestation with sn_grc_item populated
2. Complete the attestation
3. Check the logs - you should see the review being processed
4. Check x_n1ll2_c1_smart_6_review_analysis table for the review record

## Important Notes
- The Async rule runs in the background, so there may be a slight delay (few seconds) before the review completes
- If the attestation is non-compliant, it will automatically revert to "in_progress" state
- Check the Work Notes field on the attestation for review results

## Troubleshooting
If you still get HTTP errors:
1. Verify OnAttestationSubmitPP is set to Async
2. Check that the LLM configuration is enabled
3. Verify the API key is valid
4. Check System Logs for detailed error messages