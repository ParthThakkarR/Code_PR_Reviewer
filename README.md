# CodeReviewer — AI Code Review & DevSecOps SBOM Merge Gate

[![CycloneDX XML](https://img.shields.io/badge/SBOM-CycloneDX%201.4%20XML-blue.svg)](https://cyclonedx.org/)
[![SPDX JSON](https://img.shields.io/badge/SBOM-SPDX%202.3%20JSON-blue.svg)](https://spdx.dev/)
[![Security Gate](https://img.shields.io/badge/Security%20Gate-OSV%20%26%20CVE-green.svg)](https://osv.dev/)
[![Stack](https://img.shields.io/badge/Tech%20Stack-Express%20%7C%20FastAPI%20%7C%20React%20%7C%20Vite-61dafb.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Automated AI-Powered Code Reviews combined with Software Bill of Materials (SBOM) XML/JSON Generation, Real-Time Google OSV Vulnerability Auditing, and Automated Pull Request Merge Gating.**

---

## 🌟 Key Features

### 🛡️ 1. CycloneDX XML & SPDX 2.3 SBOM Generation (Feature vs Base Branch)
* **Twin XML SBOM Generation**: Generates standard **CycloneDX 1.4 XML** documents for both:
  * **Feature Branch XML SBOM**: Contains all packages and dependencies proposed in the PR with unique `bom-ref` identifiers.
  * **Current / Base Branch XML SBOM**: Represents the target/base branch state (`main`).
* **SPDX 2.3 JSON Export**: Schema-compliant SPDX 2.3 JSON generator (`spdxJsonService.js`).
* **Multi-Ecosystem Manifest & Lockfile Support**: Parses `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `Pipfile.lock`, `package.json`, and `requirements.txt`.
* **Transitive Dependency Resolution**: Extracts resolved versions without inventing default or placeholder versions.
* **Component Diff**: Categorizes changes into `Added`, `Updated`, `Removed`, and `Unchanged` components.
* **Export & Download**: Full syntax-highlighted in-browser XML viewer with single-click `.xml` download.

### 🔍 2. Real-Time OSV Vulnerability Checking (Fail-Closed)
* **Google OSV API Integration**: Scans all components in chunks via `https://api.osv.dev/v1/querybatch` without arbitrary component limits.
* **Numeric CVSS Scoring**: Parses real CVSS vectors into numeric scores (never defaulting to arbitrary constant scores).
* **Severity Breakdown**: Classifies threats into `CRITICAL`, `HIGH`, `MEDIUM`, and `LOW`.
* **Actionable Remediation**: Pinpoints exact affected versions and provides recommended upgrade releases.
* **PR Vulnerability Differentiation (Delta Mode)**: Identifies whether a vulnerability is newly introduced in the pull request or was pre-existing in the base branch.
* **Fail-Closed Gate Design**: Network timeouts, scanner failures, missing manifests, or empty SBOMs yield explicit `ERROR` states that block merge.

### 🚫 3. Strict PR Merge Gating & GitHub Synchronization
* **Server-Side Versioned Gate Policy**: Loaded from server-side config (`config/gatePolicy.json`), never from request bodies.
* **Pass Condition**: `0 Critical` and `0 High` vulnerabilities in the feature branch (configurable CVSS threshold).
* **Merge Gating**:
  * **Merge Allowed (`ALLOWED_TO_MERGE`)**: Green status banner; pull request is eligible for merge.
  * **Merge Blocked (`MERGE_BLOCKED`)**: Red alert banner; pull request merge is blocked.
* **Race Condition Protection**: PR merges pass the expected head commit `sha` to GitHub's merge API.
* **Audit Trail**: Every check record in MongoDB is bound to `owner`, `repo`, `prNumber`, `baseSha`, and `headSha`.

### 🤖 4. AI & Multi-Tool Code Analysis
* **Static Analysis**: Python microservice running `pylint`, `bandit` (AST security analysis), and `radon` (cyclomatic complexity).
* **Advisory AI Review**: Gemini-powered review for bugs, security loopholes, performance, and best practices. AI findings are strictly advisory and cannot override security gates.
* **Prompt Injection Defense & Secret Masking**: Code blocks are wrapped in system isolation tags; tokens and API keys are redacted before LLM transmission.
* **Repository-Wide Reviews**: Queue-based background processing with BullMQ and Redis with exponential backoff and graceful shutdown.

---

## 🏗️ Architecture

```
                       ┌─────────────────────────────────────────┐
                       │           React + Vite Frontend         │
                       │           (http://localhost:5173)       │
                       └────────────────────┬────────────────────┘
                                            │ HTTP / REST (/api/v1)
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │          Express Backend (Node.js)       │
                       │           (http://localhost:5001)       │
                       └──────┬──────────────────┬──────────────┬┘
                              │                  │              │
                              ▼                  ▼              ▼
                     ┌────────────────┐ ┌──────────────┐ ┌─────────────┐
                     │ Google OSV API │ │ MongoDB      │ │ Python      │
                     │ (CVE Lookup)   │ │ (ai-review)  │ │ Analyzer    │
                     └────────────────┘ └──────────────┘ │ (:8000)     │
                                                ▲        └─────────────┘
                                                │
                                         ┌─────────────┐
                                         │ Redis       │
                                         │ (Queue/Lock)│
                                         └─────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
* **Node.js** >= 20.x (Node 22 LTS recommended)
* **Python** >= 3.10
* **MongoDB** 7.0+ (running on `mongodb://127.0.0.1:27017`)
* **Redis** 7.0+ (running on `redis://127.0.0.1:6379`)
* **Docker & Docker Compose** (for containerized deployment)

### Local Development Setup

1. **Install backend dependencies:**
   ```bash
   cd backend_express
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Ensure SESSION_SECRET, GITHUB_CLIENT_ID, and MONGO_URI are configured
   ```

3. **Install frontend dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Run automated unit tests:**
   ```bash
   cd ../backend_express
   npm test
   ```

5. **Start services with Docker Compose:**
   ```bash
   docker compose up --build
   ```

---

## 🧪 Automated Testing

Run the offline unit and policy integration test suite:

```bash
cd backend_express
npm test
```

Tests cover:
* Policy engine gate evaluation (`ALLOWED_TO_MERGE`, `MERGE_BLOCKED`, delta mode, error state)
* Numeric CVSS score extraction and severity normalization
* Manifest and lockfile parsers (npm `package-lock.json`, yarn `yarn.lock`, pnpm, pip `requirements.txt`)
* Component diff calculations (added, updated, removed, unchanged)
* CycloneDX 1.4 XML schema serialization with unique `bom-ref` linking

---

## 🌐 Observability & API Endpoints

* **Health Probe**: `GET /healthz` — Service liveness
* **Readiness Probe**: `GET /readyz` — Database and dependency readiness
* **Versioned Gate API**: `POST /api/v1/sbom/check` — Fetch manifests, scan CVEs, evaluate gate
* **Versioned Merge API**: `POST /api/v1/sbom/merge` — Merge PR with SHA binding
* **SBOM Download**: `GET /api/v1/sbom/download/:id/:type` — Authenticated XML artifact download

---

## 📄 License
Released under the [MIT License](LICENSE).
