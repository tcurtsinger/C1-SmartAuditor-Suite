# Priority Field Update Required

## Change Made
The PromptBuilder has been updated to use ServiceNow's standard ordering convention where **lower numbers = higher priority** (like the Order field).

## Action Required in ServiceNow

Update your template priorities to follow the new convention:

### Current Priorities (Need Updating):
- `compliance_review_soc2`: **110** → Change to **50** (runs first for SOC2)
- `compliance_review_standard`: **100** → Keep as **100** (default)
- Other templates: **100** → Keep as **100** (default)

### New Priority Guidelines:
- **10-50**: High priority (runs first)
- **100**: Default priority
- **150-200**: Low priority (runs last)

### Example Priority Settings:
- **SOC2 template**: Priority = **50** (runs before generic)
- **Standard template**: Priority = **100** (default)
- **Fallback template**: Priority = **200** (only if nothing else matches)

## Why This Change?

This aligns with ServiceNow's standard convention where:
- Business Rules use "Order" field (lower = runs first)
- UI Actions use "Order" field (lower = appears first)
- Client Scripts use "Order" field (lower = runs first)

Now Prompt Templates follow the same pattern for consistency!

## Testing After Update

After updating priorities in ServiceNow:
1. Run the test script again
2. Verify SOC2 template (priority 50) is selected for SOC2 framework
3. Verify standard template (priority 100) is selected for generic

---

*Remember: Lower number = Higher priority (runs first)*