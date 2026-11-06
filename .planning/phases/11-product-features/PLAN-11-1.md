---
phase: 11
plan: 1
wave: 1
depends_on: []
files_modified:
  - frontend/src/pages/PrSbomGate.jsx
  - backend_express/services/githubCommentService.js
autonomous: true

must_haves:
  truths:
    - "Dashboard acts in read-only / enforcement inspection mode, guiding users that merging is governed on GitHub"
    - "Service provides structured PR comment with summary table, blocking CVEs, remediation advice, and SBOM artifact notice"
  artifacts:
    - "backend_express/services/githubCommentService.js exists"
    - "frontend/src/pages/PrSbomGate.jsx updated with read-only badge and GitHub merge guidance"
---

# Plan 11.1: Read-Only Gate Dashboard & GitHub PR Comment Service

<objective>
Align dashboard with production workflow (read-only enforcement display & download artifacts; PR merging governed on GitHub) and generate structured PR status comments.

Purpose: Requirements #64, #66 — clear separation of concerns between gate inspection UI and GitHub branch protection.
Output: githubCommentService.js and updated PrSbomGate.jsx.
</objective>

<context>
Load for context:
- frontend/src/pages/PrSbomGate.jsx
</context>

<tasks>

<task type="auto">
  <name>Create GitHub PR comment generator service</name>
  <files>backend_express/services/githubCommentService.js</files>
  <action>
    Create backend_express/services/githubCommentService.js exporting:
    `generatePrCommentMarkdown({ checkId, repo, baseBranch, featureBranch, evaluation, statistics })`
    Produce clean GitHub Markdown table:
    - Gate Status banner (🛡️ PASSED or 🚨 BLOCKED)
    - Vulnerability breakdown table (Critical, High, Medium, Low)
    - List of blocking vulnerabilities with CVE IDs, affected components, and recommended fix versions
    - Direct instructions: "Resolve the above dependencies to unblock PR merge."
  </action>
  <verify>
    node -e "import('./backend_express/services/githubCommentService.js').then(m => console.log(typeof m.generatePrCommentMarkdown))"
  </verify>
  <done>
    Markdown PR comment generator implemented.
  </done>
</task>

<task type="auto">
  <name>Update PrSbomGate UI with clear gate status badges and merge governance notice</name>
  <files>frontend/src/pages/PrSbomGate.jsx</files>
  <action>
    In PrSbomGate.jsx:
    Add clear banner explaining that this dashboard operates as an enforcement & audit monitor, and merging is controlled through GitHub branch protection rules enforcing the check run.
    Ensure artifact download buttons (CycloneDX XML) are clearly highlighted.
  </action>
  <verify>
    cd frontend; npm run build
  </verify>
  <done>
    Frontend builds without errors and UI clarifies GitHub merge workflow.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] githubCommentService generates markdown
- [ ] frontend builds cleanly
</verification>

<success_criteria>
- [ ] Product feature plans executed and verified
</success_criteria>
