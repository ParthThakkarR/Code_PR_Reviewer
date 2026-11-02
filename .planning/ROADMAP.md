# Master Roadmap & Milestones (GSD Spec)

## Milestone 1: Environment Readiness & Runtime Reliability
- [x] Phase 1.1: Install all dependencies for `backend_express` (npm), `frontend` (npm), and `analyzer_python` (Python 3 venv).
- [x] Phase 1.2: Resolve startup blockers (configure fallback ports, default MongoDB URI, resilient Redis connection handling, Passport OAuth guards).
- [x] Phase 1.3: Provide Windows PowerShell one-click startup script (`run.ps1`) and fix Python analyzer entrypoint (`uvicorn.run`).

## Milestone 2: CycloneDX XML SBOM Generation
- [x] Phase 2.1: Implement `sbomXmlService.js` to parse dependency manifests (`package.json`, `requirements.txt`).
- [x] Phase 2.2: Implement standard CycloneDX 1.4 XML serializer with metadata, component PURLs, licenses, and vulnerability schema.
- [x] Phase 2.3: Generate twin XML documents: `currentXmlSbom` (base branch) and `featureXmlSbom` (feature branch).
- [x] Phase 2.4: Implement component diff algorithm (added, removed, updated, unchanged).

## Milestone 3: Vulnerability Scanning & Security Gate
- [x] Phase 3.1: Implement `vulnerabilityService.js` with Google OSV batch API query integration.
- [x] Phase 3.2: Implement local curated CVE security catalog for fast deterministic offline evaluation.
- [x] Phase 3.3: Implement PR Merge Gate evaluator (`evaluateMergeGate`) calculating Critical, High, Medium, Low metrics and blocking criteria.

## Milestone 4: PR Merge Enforcement & DevSecOps UI Dashboard
- [x] Phase 4.1: Create MongoDB Mongoose schema `PRCheck` (`prCheck.js`) to record full scan audit histories and merge statuses.
- [x] Phase 4.2: Implement `sbomController.js` and `sbomRoutes.js` (`POST /check`, `POST /merge`, `GET /download/:id/:type`).
- [x] Phase 4.3: Strictly enforce merge gate in `POST /api/sbom/merge` with HTTP 403 rejection on vulnerability failures.
- [x] Phase 4.4: Build React PR & SBOM Gate dashboard (`PrSbomGate.jsx`) with dual XML viewers, CVE audit cards, quick test presets, and dynamic PR merge action button.
- [x] Phase 4.5: Integrate with Navigation Bar and Repo Analyzer.
- [x] Phase 4.6: End-to-end automated verification suite (`test_sbom_gate.js` and HTTP integration tests).

