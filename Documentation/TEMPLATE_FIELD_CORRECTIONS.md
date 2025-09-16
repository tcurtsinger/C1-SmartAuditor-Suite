# Prompt Template Field Corrections

## Issues Found and Fixed

After reviewing the actual ServiceNow table structure in `Tables & Fields.MD`, the following corrections were made:

### 1. Framework Field Values
**Issue**: The framework choice values in the database use underscores, but the code was checking for values without underscores.

**Database Values (Actual)**:
- `generic`
- `soc_2` (NOT `soc2`)
- `iso_27001` (NOT `iso27001`)
- `nist`
- `hipaa`
- `pci_dss` (NOT `pci_dss`)

**Fix Applied**: Updated PromptBuilder.js to automatically convert common framework names to database values:
```javascript
if (framework === 'soc2') dbFramework = 'soc_2';
else if (framework === 'iso27001') dbFramework = 'iso_27001';
else if (framework === 'pci' || framework === 'pcidss') dbFramework = 'pci_dss';
```

### 2. Compliance Status Field Values
**Database Values (Actual)**:
- `compliant` (lowercase)
- `non_compliant` (lowercase with underscore)
- `needs_review` (lowercase with underscore)

**Note**: The ComplianceAnalyzer handles these conversions already, mapping from uppercase format (COMPLIANT, NON-COMPLIANT) to the database format.

### 3. Template Type Values
**Confirmed Correct**:
- `compliance_review`
- `risk_assessment`
- `gap_analysis`
- `evidence_validation`

## Files Updated

1. **PromptBuilder.script.js**:
   - Added framework value conversion logic
   - Handles both common names (soc2) and database values (soc_2)

2. **test_prompt_templates.js**:
   - Updated to test both formats
   - Added test for direct database values

3. **PROMPT_TEMPLATES.md**:
   - Corrected framework choice documentation
   - Updated SOC2 template to use `soc_2`

## Testing Recommendations

When testing in ServiceNow, ensure:

1. **Framework values in templates match database**:
   - Use `soc_2` not `soc2`
   - Use `iso_27001` not `iso27001`
   - Use `pci_dss` not `pcidss`

2. **The system handles both formats**:
   - Code framework values: `soc2`, `iso27001`
   - Database framework values: `soc_2`, `iso_27001`

3. **Compliance status values are lowercase**:
   - `compliant`, `non_compliant`, `needs_review`

## Important Notes

- The PromptBuilder now automatically converts common framework names to database values
- This ensures backward compatibility if the code uses simplified names
- Always use the database values when creating templates in ServiceNow UI

---

*Document created to track field value corrections made on December 2024*