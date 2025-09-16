# C1 SmartAuditor Suite - Prompt Templates Configuration Guide

## Overview
This document contains the complete configuration for the prompt templates system. These templates move prompt logic from hardcoded scripts to a configurable database table, allowing for easier maintenance and customization.

## Important: Variable Names
The templates use the exact variable names as they appear in the `SmartAttestationReviewAPI.js` code. These are case-sensitive and must match exactly:
- `controlObjectiveDescription` (NOT control_objective)
- `supplementalGuidance` (NOT supplemental_guidance)  
- `attestationResponse` (NOT attestation_response)
- `controlNumber` (NOT control_number)
- `controlReference`
- `controlName`
- `controlSource`
- `controlParent`
- `framework`

**Note:** Some ideal variables like `trust_service_criteria`, `risk_appetite`, and `control_criticality` are not currently available in the system and would require code changes to implement.

---

## Table Structure: x_n1ll2_c1_smart_6_prompt_templates

### Table Configuration
- **Label**: Prompt Templates
- **Name**: x_n1ll2_c1_smart_6_prompt_templates
- **Extends**: (none - base table)
- **Application**: C1 SmartAuditor Suite

### Field Definitions

| Field Label | Field Name | Type | Max Length | Additional Properties |
|------------|------------|------|------------|----------------------|
| **Name** | name | String | 100 | Mandatory: true, Display: true |
| **Description** | description | String | 500 | Help text: "Describe what this prompt template is used for" |
| **Template Type** | template_type | Choice | - | Choices: `compliance_review`, `risk_assessment`, `gap_analysis`, `evidence_validation` |
| **Framework** | framework | Choice | - | Choices: `generic`, `soc_2`, `iso_27001`, `nist`, `hipaa`, `pci_dss` |
| **Prompt Text** | prompt_text | String | 8000 | Mandatory: true, Help text: "Use {{variable_name}} for placeholders" |
| **Variables** | variables | String | 4000 | Help text: "JSON array of required variables" |
| **Temperature** | temperature | Decimal | - | Default: 0.3, Min: 0, Max: 1 |
| **Max Tokens** | max_tokens | Integer | - | Default: 2000 |
| **Version** | version | Integer | - | Default: 1, Read-only after insert |
| **Active** | active | True/False | - | Default: true |
| **Priority** | priority | Integer | - | Default: 100, Help text: "Lower numbers = higher priority (like Order field)" |

---

## Prompt Templates

### Template 1: Standard Compliance Review

**Field Values:**
- **Name**: `compliance_review_standard`
- **Description**: Standard compliance review for attestations
- **Template Type**: `compliance_review`
- **Framework**: `generic`
- **Priority**: `100`
- **Active**: `true`
- **Temperature**: `0.3`
- **Max Tokens**: `2000`
- **Version**: `1`

**Variables Field:**
```json
["controlObjectiveDescription", "supplementalGuidance", "attestationResponse", "controlNumber", "framework"]
```

**Prompt Text:**
```
You are a compliance expert analyzing attestation responses for regulatory compliance.

CONTROL OBJECTIVE:
Number: {{controlNumber}}
Framework: {{framework}}
Description: {{controlObjectiveDescription}}

SUPPLEMENTAL GUIDANCE:
{{supplementalGuidance}}

ATTESTATION RESPONSE:
{{attestationResponse}}

Please analyze this attestation response and provide your assessment in the following JSON format:
{
    "compliance_status": "COMPLIANT or NON-COMPLIANT or NEEDS REVIEW",
    "risk_score": 1-10 (1=lowest risk, 10=highest risk),
    "gaps": ["list of specific gaps identified"],
    "recommendations": ["list of specific recommendations"],
    "evidence_needed": ["list of evidence that would strengthen the attestation"],
    "summary": "2-3 sentence summary of your analysis"
}

Consider:
- Does the response fully address the control objective?
- Are there any gaps or missing elements?
- What is the risk level associated with any gaps?
- What evidence supports the attestation?
```

---

### Template 2: Strict Compliance Review (Critical Controls)

**Field Values:**
- **Name**: `compliance_review_strict`
- **Description**: Strict compliance review for critical controls
- **Template Type**: `compliance_review`
- **Framework**: `generic`
- **Priority**: `90`
- **Active**: `true`
- **Temperature**: `0.1`
- **Max Tokens**: `2000`
- **Version**: `1`

**Variables Field:**
```json
["controlNumber", "framework", "controlObjectiveDescription", "supplementalGuidance", "attestationResponse"]
```

**Prompt Text:**
```
You are a senior compliance auditor performing a critical control assessment. Apply the strictest interpretation of compliance requirements.

CONTROL INFORMATION:
Control Number: {{controlNumber}}
Framework: {{framework}}
Control Objective: {{controlObjectiveDescription}}

IMPLEMENTATION GUIDANCE:
{{supplementalGuidance}}

ATTESTATION RESPONSE PROVIDED:
{{attestationResponse}}

CRITICAL EVALUATION CRITERIA:
- Zero tolerance for ambiguity or partial compliance
- Evidence must be explicit and verifiable
- Assumptions are not acceptable
- "Planned" or "in progress" activities do not constitute compliance

Analyze this attestation with maximum scrutiny and provide your assessment in JSON format:
{
    "compliance_status": "COMPLIANT or NON-COMPLIANT" (no middle ground for critical controls),
    "risk_score": 1-10 (7+ for any gap in critical controls),
    "gaps": ["list every gap, no matter how minor"],
    "recommendations": ["specific, actionable steps required"],
    "evidence_needed": ["exact evidence/documentation required"],
    "critical_findings": ["any findings requiring immediate attention"],
    "summary": "concise assessment focusing on compliance deficiencies"
}

Flag as NON-COMPLIANT if:
- Any required element is missing
- Evidence is vague or unverifiable
- Timelines are not specified
- Responsible parties are not identified
- Documentation is incomplete
```

---

### Template 3: SOC2 Compliance Review

**Field Values:**
- **Name**: `compliance_review_soc2`
- **Description**: SOC2-specific compliance review
- **Template Type**: `compliance_review`
- **Framework**: `soc_2`
- **Priority**: `110`
- **Active**: `true`
- **Temperature**: `0.3`
- **Max Tokens**: `2000`
- **Version**: `1`

**Variables Field:**
```json
["control_number", "framework", "controlObjectiveDescription", "supplementalGuidance", "attestationResponse"]
```

**Note:** `trust_service_criteria` would need to be added to the data model if SOC2-specific TSC tracking is needed

**Prompt Text:**
```
You are a SOC2 audit specialist evaluating Trust Service Criteria compliance.

TRUST SERVICE CRITERIA:
Control Number: {{controlNumber}}
Framework: {{framework}}
Control Objective: {{controlObjectiveDescription}}

AICPA GUIDANCE:
{{supplementalGuidance}}

MANAGEMENT'S ATTESTATION:
{{attestationResponse}}

SOC2 EVALUATION FRAMEWORK:
Assess against the five Trust Service Criteria:
1. Security - Protection against unauthorized access
2. Availability - System accessibility as agreed
3. Processing Integrity - System processing is complete, accurate, timely
4. Confidentiality - Information designated as confidential is protected
5. Privacy - Personal information is handled per privacy notice

Provide your SOC2 assessment in JSON format:
{
    "compliance_status": "COMPLIANT, NON-COMPLIANT, or NEEDS REVIEW",
    "risk_score": 1-10,
    "tsc_alignment": "which Trust Service Criteria are addressed",
    "gaps": ["specific gaps per AICPA requirements"],
    "recommendations": ["SOC2-specific remediation steps"],
    "evidence_needed": ["documentation per SOC2 Type II requirements"],
    "control_effectiveness": "Operating Effectively, Design Deficiency, or Operating Deficiency",
    "testing_procedures": ["recommended testing procedures for auditor"],
    "summary": "assessment against SOC2 Trust Service Criteria"
}

Consider SOC2-specific requirements:
- Documented policies and procedures
- Evidence of consistent operation
- Management monitoring activities
- Incident response procedures
- Change management processes
```

---

### Template 4: Gap Analysis Detailed

**Field Values:**
- **Name**: `gap_analysis_detailed`
- **Description**: Comprehensive gap analysis between current and required states
- **Template Type**: `gap_analysis`
- **Framework**: `generic`
- **Priority**: `100`
- **Active**: `true`
- **Temperature**: `0.3`
- **Max Tokens**: `2500`
- **Version**: `1`

**Variables Field:**
```json
["controlObjectiveDescription", "framework", "attestationResponse", "supplementalGuidance", "controlName"]
```

**Prompt Text:**
```
You are a compliance gap analysis expert identifying discrepancies between current and required states.

REQUIRED STATE (Control Objective):
{{controlObjectiveDescription}}

FRAMEWORK REQUIREMENTS:
{{framework}}

CURRENT STATE (Attestation):
{{attestationResponse}}

SUPPLEMENTAL GUIDANCE:
{{supplementalGuidance}}

CONTROL NAME:
{{controlName}}

Perform a comprehensive gap analysis and provide results in JSON format:
{
    "compliance_status": "COMPLIANT, PARTIALLY_COMPLIANT, or NON-COMPLIANT",
    "compliance_percentage": 0-100,
    "maturity_level": "1-Initial, 2-Managed, 3-Defined, 4-Quantitatively Managed, 5-Optimizing",
    "critical_gaps": [
        {
            "gap": "description",
            "impact": "HIGH/MEDIUM/LOW",
            "effort_required": "HIGH/MEDIUM/LOW",
            "priority": 1-5
        }
    ],
    "minor_gaps": ["list of non-critical gaps"],
    "strengths": ["existing controls that meet requirements"],
    "quick_wins": ["gaps that can be easily closed"],
    "long_term_items": ["gaps requiring significant effort"],
    "roadmap": ["prioritized list of remediation steps"],
    "resource_requirements": ["people, technology, or process needs"],
    "estimated_timeline": "timeframe to achieve compliance",
    "summary": "executive summary of gap analysis"
}

Apply systematic analysis:
- Compare each requirement against current implementation
- Identify both technical and procedural gaps
- Consider people, process, and technology dimensions
- Assess implementation maturity, not just presence/absence
```

---

### Template 5: Risk Assessment Only

**Field Values:**
- **Name**: `risk_assessment_only`
- **Description**: Focused risk assessment of control implementation
- **Template Type**: `risk_assessment`
- **Framework**: `generic`
- **Priority**: `100`
- **Active**: `true`
- **Temperature**: `0.2`
- **Max Tokens**: `2000`
- **Version**: `1`

**Variables Field:**
```json
["controlObjectiveDescription", "attestationResponse", "controlNumber", "framework"]
```

**Prompt Text:**
```
You are a risk assessment specialist evaluating control implementation risk.

CONTROL OBJECTIVE:
{{controlObjectiveDescription}}

ATTESTATION RESPONSE:
{{attestationResponse}}

CONTROL NUMBER:
{{controlNumber}}

FRAMEWORK:
{{framework}}

Perform a focused risk assessment and provide results in JSON format:
{
    "inherent_risk_score": 1-10,
    "residual_risk_score": 1-10,
    "risk_level": "CRITICAL, HIGH, MEDIUM, LOW",
    "likelihood": 1-5,
    "impact": 1-5,
    "risk_factors": [
        {
            "factor": "description",
            "contribution": "HIGH/MEDIUM/LOW"
        }
    ],
    "threat_vectors": ["potential ways this control could fail"],
    "vulnerability_assessment": ["weaknesses in current implementation"],
    "risk_mitigation_effectiveness": 0-100,
    "compensating_controls": ["other controls that might reduce risk"],
    "risk_treatment_recommendation": "ACCEPT, AVOID, TRANSFER, or MITIGATE",
    "priority_actions": ["immediate steps to reduce risk"],
    "monitoring_recommendations": ["ongoing risk monitoring suggestions"],
    "summary": "executive risk summary"
}

Risk Scoring Methodology:
- Likelihood x Impact = Risk Score
- Consider both current and emerging threats
- Account for control dependencies
- Evaluate detective vs preventive controls
- Consider the cost of control failure
```

---

### Template 6: Evidence Validation

**Field Values:**
- **Name**: `evidence_validation`
- **Description**: Assess quality and sufficiency of compliance evidence
- **Template Type**: `evidence_validation`
- **Framework**: `generic`
- **Priority**: `100`
- **Active**: `true`
- **Temperature**: `0.2`
- **Max Tokens**: `2000`
- **Version**: `1`

**Variables Field:**
```json
["controlObjectiveDescription", "attestationResponse", "framework"]
```

**Prompt Text:**
```
You are a compliance evidence validator assessing the quality and sufficiency of provided evidence.

CONTROL REQUIREMENT:
{{controlObjectiveDescription}}

EVIDENCE PROVIDED IN ATTESTATION:
{{attestationResponse}}

FRAMEWORK EVIDENCE STANDARDS:
{{framework}}

Evaluate the evidence quality and provide assessment in JSON format:
{
    "evidence_sufficiency": "SUFFICIENT, INSUFFICIENT, or PARTIAL",
    "evidence_quality_score": 1-10,
    "evidence_types_present": ["policy", "procedure", "screenshot", "log", "report", "attestation_only"],
    "evidence_gaps": ["missing evidence types"],
    "verification_status": "VERIFIABLE, PARTIALLY_VERIFIABLE, or UNVERIFIABLE",
    "specific_evidence_needed": [
        {
            "evidence_type": "description",
            "purpose": "what it would demonstrate",
            "priority": "CRITICAL/HIGH/MEDIUM/LOW"
        }
    ],
    "evidence_recommendations": ["how to strengthen evidence"],
    "documentation_quality": "assessment of documentation completeness",
    "audit_readiness": 0-100,
    "summary": "overall evidence assessment"
}

Evidence Evaluation Criteria:
- Relevance to control objective
- Completeness and clarity
- Timeliness (how current is the evidence)
- Independence and objectivity
- Consistency with other evidence
- Ability to be independently verified
```

---

## Access Control Configuration

### ACLs (Access Control Lists)
Create the following ACLs for the prompt templates table:

| Operation | Role | Condition |
|-----------|------|-----------|
| Read | x_n1ll2_c1_smart_6.smartauditor_user | None |
| Write | x_n1ll2_c1_smart_6.smartauditor_admin | None |
| Create | x_n1ll2_c1_smart_6.smartauditor_admin | None |
| Delete | x_n1ll2_c1_smart_6.smartauditor_admin | None |

### Module Configuration
Create a new module under C1 SmartAuditor Suite:
- **Title**: Prompt Templates
- **Table**: x_n1ll2_c1_smart_6_prompt_templates
- **View**: Default view
- **Roles**: x_n1ll2_c1_smart_6.smartauditor_admin

---

## Implementation Notes

### Variable Replacement
The PromptBuilder script will replace {{variable_name}} placeholders with actual values from the attestation data. Ensure all variables listed in the Variables field are available in the data passed to the PromptBuilder.

### Template Selection Logic
Templates are selected based on:
1. **Framework match** (if specified)
2. **Template type** match
3. **Priority** (lower number = higher priority, like ServiceNow Order field)
4. **Active** status (must be true)

### Fallback Behavior
If no suitable template is found, the system should fall back to the hardcoded prompt in the PromptBuilder script to ensure continuity of service.

### Version Management
- Version numbers should increment when templates are modified
- Consider keeping previous versions inactive for rollback capability
- Cache keys should include version number to prevent stale cache hits

---

## Adding New Variables

To add new variables to the templates, you need to:

1. **Update SmartAttestationReviewAPI.js** - Add the new data to the `promptData` object (lines 26-36)
2. **Update _getAttestationData method** - Retrieve the new data from ServiceNow tables
3. **Update the prompt template** - Add {{newVariable}} to the template text
4. **Update the Variables field** - Add the new variable name to the JSON array

### Example: Adding risk_appetite
```javascript
// In SmartAttestationReviewAPI.js, add to promptData:
var promptData = {
    // existing variables...
    risk_appetite: attestationData.risk_appetite // Add this
};

// In _getAttestationData method, retrieve it:
// Perhaps from a system property or control record
var risk_appetite = gs.getProperty('x_n1ll2_c1_smart_6.risk_appetite', 'moderate');
```

## Future Enhancements

1. **Template Testing Interface**: Create a UI to test templates with sample data
2. **Template Analytics**: Track which templates are used most frequently
3. **Dynamic Variable Discovery**: Automatically detect available variables
4. **Template Inheritance**: Allow templates to extend base templates
5. **A/B Testing**: Support multiple active templates for comparison
6. **Template Import/Export**: Enable sharing templates between environments
7. **Add Missing Variables**: Implement risk_appetite, control_criticality, trust_service_criteria

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Author: C1 SmartAuditor Suite Development Team*