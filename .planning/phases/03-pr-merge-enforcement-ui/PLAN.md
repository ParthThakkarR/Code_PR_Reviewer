# Phase 3: PR Merge Enforcement & DevSecOps UI - Plan

## Objectives
1. Build backend REST endpoints for PR checking and merge enforcement.
2. Build interactive React UI dashboard for SBOM XML viewing and PR merge gating.
3. Ensure strict HTTP 403 blocking when checks fail.
4. Verify all components compile and execute cleanly.

## Tasks
- [x] Create Mongoose model `PRCheck` (`backend_express/models/prCheck.js`).
- [x] Create controller `backend_express/controllers/sbomController.js` and routes `backend_express/routes/sbomRoutes.js`.
- [x] Create frontend page `frontend/src/pages/PrSbomGate.jsx`.
- [x] Add navigation links in `Navbar.jsx` and `RepoAnalyzer.jsx`.
- [x] Build and test frontend using Vite (`npm run build`).
- [x] Provide one-click PowerShell startup script (`run.ps1`).

