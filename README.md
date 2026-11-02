# CodeReviewer — AI Code Review & DevSecOps SBOM Merge Gate

[![CycloneDX XML](https://img.shields.io/badge/SBOM-CycloneDX%201.4%20XML-blue.svg)](https://cyclonedx.org/)
[![Security Gate](https://img.shields.io/badge/Security%20Gate-OSV%20%26%20CVE-green.svg)](https://osv.dev/)
[![Stack](https://img.shields.io/badge/Tech%20Stack-Express%20%7C%20FastAPI%20%7C%20React%20%7C%20Vite-61dafb.svg)]()
[![GSD Spec](https://img.shields.io/badge/Workflow-GSD%20Spec--Driven-orange.svg)]()

> **Automated AI-Powered Code Reviews combined with Software Bill of Materials (SBOM) XML Generation, Real-Time CVE Vulnerability Auditing, and Automated Pull Request Merge Gating.**

---

## 🌟 Key Features

### 🛡️ 1. CycloneDX XML SBOM Generation (Feature vs Base Branch)
* **Twin XML SBOM Generation**: Generates standard **CycloneDX 1.4 XML** documents for both:
  * **Feature Branch XML SBOM**: Contains all packages and dependencies proposed in the PR.
  * **Current / Base Branch XML SBOM**: Represents the target/base branch state (`main`).
* **Multi-Ecosystem Manifest Support**: Automatically parses `package.json`, `package-lock.json` (npm), and `requirements.txt` (PyPI).
* **Dependency Diff**: Categorizes changes into `Added`, `Updated`, `Removed`, and `Unchanged` components.
* **Export & Download**: Full syntax-highlighted in-browser XML viewer with single-click `.xml` download.

### 🔍 2. Real-Time CVE Vulnerability Checking
* **Google OSV API Integration**: Scans all components against authoritative vulnerability databases (`https://api.osv.dev/v1/querybatch`) for up-to-date CVEs and GitHub Security Advisories (GHSA).
* **Severity Breakdown**: Classifies threats into `CRITICAL`, `HIGH`, `MEDIUM`, and `LOW` with numeric CVSS scores.
* **Actionable Remediation**: Pinpoints exact affected versions and provides recommended upgrade releases.
* **PR Vulnerability Differentiation**: Identifies whether a vulnerability is newly introduced in the pull request or was pre-existing in the base branch.

### 🚫 3. Strict PR Merge Gating
* **Security Policy Gate**:
  * **Pass Condition**: `0 Critical` and `0 High` vulnerabilities in the feature branch.
  * **Merge Allowed (`ALLOWED_TO_MERGE`)**: Green status banner; **[Merge Pull Request]** button is unlocked.
  * **Merge Blocked (`MERGE_BLOCKED`)**: Red alert banner; **[Merge Pull Request]** button is strictly locked.
* **API-Level Enforcement**: Calling `POST /api/sbom/merge` on a failing branch returns `HTTP 403 Forbidden` with blocking CVE reasons.

### 🤖 4. AI & Multi-Tool Code Analysis
* **Static Analysis**: Python microservice running `pylint`, `bandit` (AST security analysis), and `radon` (cyclomatic complexity).
* **AI Analysis**: Gemini-powered senior software engineer review for bugs, security loopholes, performance, and best practices.
* **Repository-Wide Reviews**: Queue-based background processing with BullMQ and Redis.

---

## 🏗️ Architecture

```
                       ┌─────────────────────────────────────────┐
                       │           React + Vite Frontend         │
                       │           (http://localhost:5173)       │
                       └────────────────────┬────────────────────┘
                                            │ HTTP / REST
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
                                                         └─────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
* **Node.js** >= 18.x
* **Python** >= 3.10
* **MongoDB** (running on `mongodb://127.0.0.1:27017`)

### One-Click Startup on Windows (PowerShell)
```powershell
.\run.ps1
```

### One-Click Startup on macOS / Linux
```bash
chmod +x run.sh
./run.sh
```

---

## 🌐 Services Overview

| Service | Technology | URL | Description |
|---|---|---|---|
| **Frontend** | React 19, Vite | [http://localhost:5173](http://localhost:5173) | UI, Code Review, Repo Analyzer & PR Gate |
| **PR & SBOM Gate** | React Component | [http://localhost:5173/sbom-pr](http://localhost:5173/sbom-pr) | CycloneDX XML viewer & PR merge gating |
| **Backend API** | Node.js, Express 5 | [http://localhost:5001](http://localhost:5001) | REST API, SBOM engine, auth, merge gate |
| **Python Analyzer** | FastAPI, Uvicorn | [http://localhost:8000](http://localhost:8000) | Pylint, Bandit, Radon code analyzer |
| **Database** | MongoDB | `mongodb://localhost:27017` | Repositories, reviews, and PR gate checks |

---

## 🧪 Testing the PR & SBOM Gate

You can test the merge gate directly in the dashboard at `/sbom-pr`:

1. **🟢 Safe Feature Branch Scenario**:
   * Uses clean packages (`dotenv@17.3.1`, `ms@2.1.3`, `dayjs@1.11.13`, `clsx@2.1.1`).
   * Vulnerability scan: **0 CVEs**.
   * Gate status: **`ALLOWED_TO_MERGE`**.
   * Clicking **Merge Pull Request** executes the merge.

2. **🔴 Vulnerable Feature Branch Scenario**:
   * Adds packages with known CVEs (`jsonwebtoken@9.0.0`, `axios@0.21.1`, `lodash@4.17.15`).
   * Vulnerability scan: **Critical & High CVEs detected**.
   * Gate status: **`MERGE_BLOCKED`**.
   * The **Merge Pull Request** button is disabled, and API requests return `403 Forbidden`.

---

## 📁 Repository Structure

```text
.
├── .planning/                  # GSD spec files (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md)
├── analyzer_python/            # Python FastAPI static analysis service (pylint, bandit, radon)
│   ├── main.py
│   └── requirements.txt
├── backend_express/            # Express.js REST API & DevSecOps engine
│   ├── controllers/            # sbomController.js, repoController.js, reviewController.js
│   ├── models/                 # prCheck.js, repo.js, review.js
│   ├── routes/                 # sbomRoutes.js, repoRoutes.js, authRoutes.js
│   ├── services/               # sbomXmlService.js, vulnerabilityService.js, prMergeService.js
│   └── test_sbom_gate.js       # Automated test suite
├── frontend/                   # React + Vite frontend
│   └── src/
│       ├── pages/              # PrSbomGate.jsx, RepoAnalyzer.jsx, CodeReview.jsx
│       └── components/         # Navbar.jsx
├── run.ps1                     # One-click startup script for Windows
├── run.sh                      # One-click startup script for Unix/macOS
└── docker-compose.yml          # Containerized setup
```

---

## 📄 License
ISC License.
