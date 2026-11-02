# Project State & Verification Memory (GSD Spec)

## Current Status
- **Overall Status**: Complete & Verified (All tests passing)
- **Active Phase**: Production Ready & Running
- **Last Verification**: 2026-11-03 (Automated verification completed with 100% pass rate)

## Key Technical Decisions
1. **CycloneDX 1.4 XML Format**: Selected as the industry-standard XML SBOM format, matching OWASP and NIST supply chain security standards.
2. **Dual-Layer Vulnerability Scanning**: Blends live Google OSV batch API queries with a local curated CVE catalog for instant offline testing and zero-delay feedback.
3. **Strict Gate Enforcement**: Both API level (HTTP 403 Forbidden on `POST /api/sbom/merge`) and client level (disabled button with security rationale) prevent vulnerable PRs from merging.
4. **Resilient Initialization**: Express server starts smoothly regardless of whether Redis or GitHub OAuth app credentials are configured, avoiding fatal crashes during development.
5. **Windows Native Script**: Created `run.ps1` for PowerShell alongside existing `run.sh` to provide native 1-click startup on Windows environments.

## Verification Checklist
- [x] Base branch XML SBOM generation (`<?xml ... <bom xmlns="http://cyclonedx.org/schema/bom/1.4">`)
- [x] Feature branch XML SBOM generation with embedded `<vulnerabilities>`
- [x] Clean Feature Branch -> 0 CVEs -> `ALLOWED_TO_MERGE` -> PR merged successfully
- [x] Vulnerable Feature Branch -> 33 CVEs (including Critical/High) -> `MERGE_BLOCKED` -> Merge request rejected with HTTP 403
- [x] Frontend compiles via Vite without errors
- [x] Express backend starts on port 5001 and connects to MongoDB
- [x] Python analyzer FastAPI service runs on port 8000 and responds to `/` and `/analyze`

