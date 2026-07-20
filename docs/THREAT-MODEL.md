# Biometric Check-in Threat Model

## Scope
This document covers the biometric check-in flow for workspace attendance. The goal is to ensure that only privacy-safe references are stored by the application and that raw biometric templates never enter the database.

## Assets and Risks
- Raw biometric templates are considered highly sensitive personal data.
- Exposure can lead to identity theft, GDPR non-compliance, and reputational harm.
- The application should minimize persistence, reduce retention, and avoid storing reusable biometric rows in relational storage.

## Security Controls

1. **Raw biometric data is rejected at the API boundary.**  
   The `CheckInProvider.validateBiometricPrivacy()` method rejects known raw-biometric field names (`biometricTemplate`, `biometricTemplateData`, `biometricSample`, `rawBiometricTemplate`, `fingerprintTemplate`, `faceTemplate`) with a `400 Bad Request` before any data reaches the database.

2. **Only privacy-safe values are accepted.**  
   The API accepts exactly one of:
   - `biometricTemplateHash` — a cryptographic hash (max 128 chars) of a biometric template, or
   - `biometricStorageReference` — an opaque reference (max 255 chars) to a template stored in an external vendor-managed system.

3. **Processing location is tracked.**  
   The `biometricProcessingLocation` field (`'local'` | `'vendor'`) records where template matching occurs. When set to `'vendor'`, the `biometricVendor` field must also be provided.

4. **Local on-device processing is preferred.**  
   The `biometricProcessingLocation` default is `'local'`, indicating templates should be processed and matched on the user's device where possible.

5. **A storage audit report is available for administrators.**  
   The `CheckInProvider.getStorageAuditSummary()` method returns a structured report with counts of total logs, logs with hashed templates, and logs with opaque storage references. It enforces a `rawBiometricRows: 0` guarantee — any non-zero value would indicate a policy violation.

## Data Handling Policy

- No raw biometric rows are stored in the application database.
- The `workspace_logs` table stores only these privacy-safe columns:

  | Column | Type | Max length | Purpose |
  |--------|------|:----------:|---------|
  | `biometricTemplateHash` | `varchar` | 128 | Store a cryptographic hash of the template |
  | `biometricStorageReference` | `varchar` | 255 | Opaque reference to a vendor-managed template |
  | `biometricProcessingLocation` | `varchar` | 32 | `'local'` or `'vendor'` — where matching occurs |
  | `biometricVendor` | `varchar` | 64 | Vendor name when templates are stored externally |

- If a vendor is used, the application records only the opaque reference (`biometricStorageReference`) and vendor name (`biometricVendor`). The raw template is never transmitted to the application database.
- The `biometricProcessingLocation` field documents which party performs template matching — `'local'` (on-device) or `'vendor'` (external service). This provenance is recorded for audit and compliance purposes.

## References
- NIST SP 800-63B: Digital Identity Guidelines: Authentication and Lifecycle Management
