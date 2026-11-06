---
phase: 9
plan: 2
wave: 2
depends_on: [9.1]
files_modified:
  - backend_express/index.js
  - backend_express/utils/logger.js
  - backend_express/middleware/errorHandler.js
autonomous: true

must_haves:
  truths:
    - "API endpoints mounted under versioned /api/v1 route alongside backward-compatible /api aliases"
    - "Centralized error handler returns unified JSON error response format without leaking stack traces or secrets"
    - "Structured JSON logger with correlation IDs (request ID, PR, commit SHA)"
  artifacts:
    - "backend_express/utils/logger.js exists"
    - "backend_express/middleware/errorHandler.js exists"
---

# Plan 9.2: API Versioning (/api/v1), Unified Error Format & Structured Logging

<objective>
Introduce API versioning (/api/v1), standard error formatting, and structured JSON logging with correlation IDs.

Purpose: Requirements #10, #56, #57 — observability, client stability, and confidential log hygiene.
Output: logger.js, errorHandler.js, and versioned routes in index.js.
</objective>

<context>
Load for context:
- backend_express/index.js
</context>

<tasks>

<task type="auto">
  <name>Create structured JSON logger and centralized error handler</name>
  <files>backend_express/utils/logger.js, backend_express/middleware/errorHandler.js</files>
  <action>
    1. Create backend_express/utils/logger.js:
       Structured JSON output with timestamp, level, message, correlationId, and automatic redaction of sensitive keys (`token`, `secret`, `key`, `password`, `code`).
    2. Create backend_express/middleware/errorHandler.js:
       Standard error response: `{ success: false, error: { code: err.code || "INTERNAL_ERROR", message: isProd ? "An unexpected error occurred" : err.message } }`.
       Never expose stack traces in production.
  </action>
  <verify>
    node -e "import('./backend_express/utils/logger.js').then(m => console.log(typeof m.logger.info))"
  </verify>
  <done>
    Logger and error handling middleware created with data masking.
  </done>
</task>

<task type="auto">
  <name>Mount versioned /api/v1 routes in Express</name>
  <files>backend_express/index.js</files>
  <action>
    In backend_express/index.js:
    Mount routes on `/api/v1/sbom`, `/api/v1/review`, `/api/v1/repo`, `/api/v1/auth`, while retaining backward-compatible aliases on `/api/sbom`, etc.
    Add request correlation ID middleware (`x-request-id` header).
    Register centralized errorHandler at the very end of middleware pipeline.
  </action>
  <verify>
    node -e "import('./backend_express/index.js').then(() => console.log('Mounted successfully'))"
  </verify>
  <done>
    Versioned endpoints mounted and error handler bound.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] /api/v1/sbom and /api/sbom routes both respond
- [ ] Error handler formats errors cleanly
</verification>

<success_criteria>
- [ ] Unified error formatting and versioned endpoints in place
</success_criteria>
