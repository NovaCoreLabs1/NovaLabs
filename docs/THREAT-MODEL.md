# Biometric Check-in Threat Model

## Scope
This document covers the biometric check-in flow for workspace attendance. The goal is to ensure that only privacy-safe references are stored by the application and that raw biometric templates never enter the database.

## Assets and Risks
- Raw biometric templates are considered highly sensitive personal data.
- Exposure can lead to identity theft, GDPR non-compliance, and reputational harm.
- The application should minimize persistence, reduce retention, and avoid storing reusable biometric rows in relational storage.

## Security Controls
1. Raw biometric data is rejected at the API boundary.
2. Only one of the following is accepted:
   - a cryptographic hash of a biometric template, or
   - an opaque storage reference to a vendor-managed system.
3. Processing should prefer local on-device handling whenever possible.
4. A storage audit report is available for administrators to review the current policy posture.

## Data Handling Policy
- No raw biometric rows are stored in the application database.
- The database stores only privacy-safe markers and metadata needed for attendance workflows.
- If a vendor is used, the application records only the opaque reference and vendor name.

## References
- NIST SP 800-63B: Digital Identity Guidelines: Authentication and Lifecycle Management
