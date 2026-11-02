# Project: CodeReviewer & DevSecOps SBOM Merge Gate

## 1. Vision & Core Value
CodeReviewer is an enterprise-grade AI-powered code review platform and DevSecOps pull request merge gate. It combines multi-language static analysis (pylint, bandit, radon), generative AI code audits, automated CycloneDX XML Software Bill of Materials (SBOM) generation for both base and feature branches, real-time CVE vulnerability checking via the Google OSV database and curated advisories, and strict PR merge gating.

## 2. Core Capabilities
- **Automated CycloneDX XML SBOM Generation**:
  - Automatically parses dependency manifests (`package.json`, `package-lock.json`, `requirements.txt`).
  - Generates valid, standard CycloneDX 1.4 XML documents for the **Feature Branch** and the **Current/Base Branch**.
  - Formats component identifiers, package URLs (PURLs), licenses, and embedded vulnerability extensions.
  - Supports instant XML inspection, copying, and file downloads.
- **Real-Time Vulnerability Auditing**:
  - Scans all SBOM components against the Google Open Source Vulnerabilities (OSV) API and local offline curated security catalog.
  - Identifies CVE IDs, GHSA advisories, CVSS scores, severities (CRITICAL, HIGH, MEDIUM, LOW), and suggested remediation versions.
  - Computes dependency and vulnerability diffs (new vulnerabilities introduced by PR vs existing base vulnerabilities).
- **Strict PR Merge Gating**:
  - Enforces policy: PR is **ALLOWED TO MERGE** if and only if all vulnerability checks pass (zero Critical or High vulnerabilities).
  - If blocking vulnerabilities are detected, PR merge is **STRICTLY BLOCKED** both at the backend REST API level (HTTP 403 Forbidden) and in the frontend UI.
- **Full-Stack Autonomous Code Review**:
  - Python FastAPI analyzer service for Python linting, security scanning (Bandit), and complexity analysis (Radon).
  - Node.js Express backend with MongoDB and Redis/BullMQ asynchronous job queue.
  - React/Vite frontend dashboard with interactive testing scenarios.

## 3. Architectural Constraints & Non-Negotiables
- **XML SBOM Standard**: CycloneDX 1.4 schema (`xmlns="http://cyclonedx.org/schema/bom/1.4"`).
- **Zero-Crash Resilience**: Backend must start cleanly even if optional external dependencies (e.g. live GitHub OAuth or standalone Redis) are absent, utilizing in-memory fallbacks and demo login mechanisms.
- **Cross-Platform Compatibility**: Full execution support on Windows (PowerShell `run.ps1`) and Unix/macOS (`run.sh`).

