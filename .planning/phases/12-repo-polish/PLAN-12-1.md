---
phase: 12
plan: 1
wave: 1
depends_on: []
files_modified:
  - LICENSE
  - SECURITY.md
  - CONTRIBUTING.md
  - README.md
autonomous: true

must_haves:
  truths:
    - "LICENSE (MIT or Apache 2.0) present at repo root"
    - "SECURITY.md defines vulnerability reporting process and scope"
    - "CONTRIBUTING.md provides developer setup, testing, and PR conventions"
    - "README.md accurately reflects real behavior, includes Redis and Docker in prerequisites, and explains gate policy"
  artifacts:
    - "LICENSE exists"
    - "SECURITY.md exists"
    - "CONTRIBUTING.md exists"
    - "README.md updated"
---

# Plan 12.1: Repository Polish, Governance & Compliance Documents

<objective>
Provide standard open-source governance and compliance documentation: LICENSE, SECURITY.md, CONTRIBUTING.md, and updated production README.

Purpose: Requirements #67, #68, #70 — production readiness, compliance, and clear documentation.
Output: LICENSE, SECURITY.md, CONTRIBUTING.md, and comprehensive README.md.
</objective>

<context>
Load for context:
- README.md
</context>

<tasks>

<task type="auto">
  <name>Create LICENSE, SECURITY.md, and CONTRIBUTING.md</name>
  <files>LICENSE, SECURITY.md, CONTRIBUTING.md</files>
  <action>
    1. Create LICENSE with MIT license text for Code_PR_Reviewer.
    2. Create SECURITY.md specifying:
       - Supported versions
       - Vulnerability disclosure and reporting email (security@example.com / repository security tab)
       - Response timeline (48 hours response, coordinated disclosure)
    3. Create CONTRIBUTING.md specifying:
       - Prerequisites (Node.js 20+, MongoDB, Redis)
       - Local development workflow
       - Testing with `npm test`
       - Branching and PR naming conventions
  </action>
  <verify>
    Test-Path LICENSE; Test-Path SECURITY.md; Test-Path CONTRIBUTING.md
  </verify>
  <done>
    Governance documents created.
  </done>
</task>

<task type="auto">
  <name>Update README.md with production prerequisites and gate policy overview</name>
  <files>README.md</files>
  <action>
    Update README.md:
    - Ensure Prerequisites explicitly include Redis 7+ and MongoDB 7+ alongside Node.js and Python.
    - Document the fail-closed merge gate policy (Standard: block on Critical or High CVEs).
    - Document the CycloneDX 1.4 XML and SPDX 2.3 exports.
    - Provide instructions for running unit tests (`npm test`) and Docker Compose (`docker compose up`).
  </action>
  <verify>
    grep "Redis" README.md
  </verify>
  <done>
    README matches production architecture and instructions.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] LICENSE, SECURITY.md, CONTRIBUTING.md exist at root
- [ ] README.md contains updated operational instructions
</verification>

<success_criteria>
- [ ] Open source governance and documentation complete
</success_criteria>
