# Requirements Specification (GSD Spec)

## Functional Requirements

### 1. SBOM XML Generation
- **REQ-SBOM-01**: The system must extract components and dependencies from manifests (`package.json`, `package-lock.json`, `requirements.txt`).
- **REQ-SBOM-02**: The system must generate valid CycloneDX 1.4 XML for the **Feature Branch** (`featureXmlSbom`).
- **REQ-SBOM-03**: The system must generate valid CycloneDX 1.4 XML for the **Current/Base Feature Branch** (`currentXmlSbom`).
- **REQ-SBOM-04**: Both generated XML files must be downloadable (`.xml` attachments) and readable within the UI.
- **REQ-SBOM-05**: The system must compute component diffs between branches (added, removed, updated, unchanged).

### 2. Vulnerability Checking
- **REQ-VULN-01**: The system must scan SBOM components against vulnerability databases (Google OSV API and offline CVE catalog).
- **REQ-VULN-02**: Vulnerabilities must be classified by severity: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.
- **REQ-VULN-03**: Each detected vulnerability must detail CVE/GHSA ID, package, affected version, CVSS score, and recommended fix version.
- **REQ-VULN-04**: The system must distinguish newly introduced vulnerabilities in the PR from existing base branch vulnerabilities.

### 3. PR Merge Gate Enforcement
- **REQ-GATE-01**: If any blocking vulnerability (Critical or High) exists in the feature branch, `passVulnerabilityCheck` must evaluate to `false` and `canMerge` must evaluate to `false`.
- **REQ-GATE-02**: If all vulnerability checks pass (zero Critical or High vulnerabilities), `passVulnerabilityCheck` must evaluate to `true` and `canMerge` must evaluate to `true`.
- **REQ-GATE-03**: Attempting to merge a blocked PR via `POST /api/sbom/merge` must return HTTP 403 Forbidden with detailed blocking reasons.
- **REQ-GATE-04**: Only when `canMerge === true` may the PR be merged (via GitHub API if token exists or local audit log update).
- **REQ-GATE-05**: The UI must display a prominent merge gate status banner (`ALLOWED TO MERGE` vs `MERGE BLOCKED`) and disable the merge button when blocked.

### 4. Project Runtime & Execution
- **REQ-RUN-01**: All project dependencies must be installable and verifiable across `backend_express`, `analyzer_python`, and `frontend`.
- **REQ-RUN-02**: The backend, python analyzer, and frontend services must run concurrently and communicate via localhost.
- **REQ-RUN-03**: One-click startup scripts must be provided for Windows (`run.ps1`) and macOS/Linux (`run.sh`).

