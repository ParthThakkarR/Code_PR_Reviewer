# Phase 1: CycloneDX XML SBOM Generation - Plan

## Objectives
1. Parse dependency manifest files from npm (`package.json`, `package-lock.json`) and PyPI (`requirements.txt`).
2. Generate valid CycloneDX 1.4 XML documents for the current/base branch and feature branch.
3. Compute package differences between the two branches.

## Tasks
- [x] Create `backend_express/services/sbomXmlService.js` with `parsePackageJson` and `parseRequirementsTxt`.
- [x] Implement `generateCycloneDxXml` adhering to the CycloneDX 1.4 XML specification schema.
- [x] Implement `diffComponents` to track added, removed, updated, and unchanged components.

