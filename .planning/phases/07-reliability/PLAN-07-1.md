---
phase: 7
plan: 1
wave: 1
depends_on: []
files_modified:
  - backend_express/config/env.js
  - backend_express/config/db.js
  - backend_express/index.js
  - backend_express/models/prCheck.js
autonomous: true

must_haves:
  truths:
    - "Server crashes on startup if required environment variables are invalid/missing"
    - "Server exits process on database connection failure in production"
    - "PRCheck schema has compound unique index on { repo, prNumber, headSha }"
    - "Healthz and Readyz endpoints return explicit JSON status and dependency checks"
  artifacts:
    - "backend_express/config/env.js validates environment variables with zod"
    - "backend_express/config/db.js fails on connection error"
    - "GET /healthz and GET /readyz endpoints implemented in index.js"
---

# Plan 7.1: Environment Schema Validation, Database Hardening & Health Probes

<objective>
Enforce fail-fast startup on configuration or DB connection failure, add MongoDB indexing/TTL, and provide /healthz and /readyz endpoints.

Purpose: Requirements #39, #41, #43 — production stability, predictable failures, and orchestrator readiness probes.
Output: Strict env validator, fail-closed DB connector, compound indexes on PRCheck, /healthz and /readyz endpoints.
</objective>

<context>
Load for context:
- backend_express/config/db.js
- backend_express/index.js
- backend_express/models/prCheck.js
</context>

<tasks>

<task type="auto">
  <name>Create strict environment validation with Zod and fail startup on error</name>
  <files>backend_express/config/env.js, backend_express/index.js</files>
  <action>
    Create backend_express/config/env.js:
    Use Zod to validate `process.env`:
    - PORT: z.coerce.number().default(5001)
    - NODE_ENV: z.enum(["development", "test", "production"]).default("development")
    - SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars")
    - MONGODB_URI: z.string().url().default("mongodb://localhost:27017/code_reviewer")
    - ALLOWED_ORIGINS: z.string().default("http://localhost:5173")
    - GEMINI_API_KEY: z.string().optional()
    
    If validation fails, print formatted error table to console.error and call `process.exit(1)`.
    Export validated `env` object.
    In backend_express/index.js, import `./config/env.js` immediately after `./load-env.js`.
  </action>
  <verify>
    node -e "import('./backend_express/config/env.js').then(() => console.log('Env valid'))"
  </verify>
  <done>
    Startup validates all required configuration. Invalid env variables crash with exit code 1.
  </done>
</task>

<task type="auto">
  <name>Harden DB connection, add MongoDB indexes and /healthz, /readyz endpoints</name>
  <files>backend_express/config/db.js, backend_express/models/prCheck.js, backend_express/index.js</files>
  <action>
    1. In db.js:
       On connection error, log fatal error and if in production (`process.env.NODE_ENV === 'production'`), call `process.exit(1)`. Export `isDbConnected()` helper.
    2. In prCheck.js:
       Add compound index: `PRCheckSchema.index({ owner: 1, repo: 1, prNumber: 1, headSha: 1 });`
       Add TTL index on `createdAt` (e.g. 90 days retention: `expireAfterSeconds: 7776000`).
    3. In index.js:
       Add `/healthz` endpoint returning `{ status: "ok", timestamp: new Date().toISOString() }`.
       Add `/readyz` endpoint checking database status via `isDbConnected()`; return 200 `{ status: "ready", db: "connected" }` or 503 `{ status: "not_ready", db: "disconnected" }`.
  </action>
  <verify>
    node -e "import('./backend_express/config/db.js').then(m => console.log(typeof m.isDbConnected))"
  </verify>
  <done>
    Database failures fail closed in production, prCheck has compound and TTL indexes, /healthz and /readyz report live status.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] /healthz returns 200 OK
- [ ] /readyz returns 200 or 503 based on database connectivity
- [ ] prCheck has compound index defined
</verification>

<success_criteria>
- [ ] Fail-fast startup implemented
- [ ] Health and readiness endpoints operational
</success_criteria>
