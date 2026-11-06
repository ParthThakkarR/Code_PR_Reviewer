---
phase: 9
plan: 1
wave: 1
depends_on: []
files_modified:
  - backend_express/package.json
  - backend_express/tests/policyEngine.test.js
  - backend_express/tests/lockfileParsers.test.js
autonomous: true

must_haves:
  truths:
    - "npm test runs real automated unit/integration tests without requiring live MongoDB or Redis"
    - "Tests cover policy gate evaluations: pass, fail on Critical, fail on High, error handling"
    - "Tests cover lockfile and manifest parsing (npm, pip, yarn, pnpm, poetry)"
    - "eslint moved to devDependencies"
  artifacts:
    - "backend_express/tests/policyEngine.test.js exists"
    - "backend_express/tests/lockfileParsers.test.js exists"
    - "npm test script executes node native test runner or vitest"
---

# Plan 9.1: Test Suite Implementation & Dependency Hygiene

<objective>
Implement automated unit tests for the policy engine, vulnerability gate evaluation, and lockfile parsers without network or database dependencies.

Purpose: Requirements #51, #52, #55 — reproducible offline testing, continuous verification, and package hygiene.
Output: Real `npm test` script, comprehensive unit tests in backend_express/tests/.
</objective>

<context>
Load for context:
- backend_express/package.json
- backend_express/services/vulnerabilityService.js
- backend_express/services/sbomXmlService.js
</context>

<tasks>

<task type="auto">
  <name>Move eslint to devDependencies and configure test runner script</name>
  <files>backend_express/package.json</files>
  <action>
    In backend_express/package.json:
    1. Move `eslint` from `dependencies` to `devDependencies`.
    2. Set `"test": "node --test tests/**/*.test.js"` using Node's built-in fast test runner (works in Node 20+ without extra heavy frameworks).
  </action>
  <verify>
    npm test --prefix backend_express
  </verify>
  <done>
    npm test is configured to run tests using node --test.
  </done>
</task>

<task type="auto">
  <name>Create unit tests for policy engine and lockfile parsers</name>
  <files>backend_express/tests/policyEngine.test.js, backend_express/tests/lockfileParsers.test.js</files>
  <action>
    1. Create backend_express/tests/policyEngine.test.js using `node:test` and `node:assert`:
       - Test clean feature branch evaluates to `ALLOWED_TO_MERGE` with `canMerge: true`.
       - Test critical vulnerability causes `MERGE_BLOCKED` and `canMerge: false`.
       - Test high vulnerability causes `MERGE_BLOCKED` under standard policy.
       - Test error condition via `makeErrorResult` sets `status: 'ERROR'` and `canMerge: false`.
    2. Create backend_express/tests/lockfileParsers.test.js:
       - Test `parsePackageJson` extracts dependencies without inventing default versions or hardcoded licenses.
       - Test `parsePackageLockJson` extracts components from package-lock format.
       - Test `parseRequirementsTxt` parses requirements lines with version specifiers.
       - Test `diffComponents` accurately computes added, removed, and updated libraries.
  </action>
  <verify>
    npm test --prefix backend_express
  </verify>
  <done>
    Unit tests pass completely with 0 network or database calls.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] npm test runs and exits with code 0
- [ ] No network or DB calls in test execution
</verification>

<success_criteria>
- [ ] All unit tests pass cleanly
</success_criteria>
