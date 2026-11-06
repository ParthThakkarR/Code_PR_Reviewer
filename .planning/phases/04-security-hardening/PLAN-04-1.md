---
phase: 4
plan: 1
wave: 1
depends_on: []
files_modified:
  - backend_express/middleware/authMiddleware.js
  - backend_express/routes/authRoutes.js
  - backend_express/index.js
autonomous: true

must_haves:
  truths:
    - "x-demo-user header bypass is removed entirely"
    - "/api/auth/dev-login GET and POST routes are removed"
    - "SESSION_SECRET has no fallback string (startup fails if missing)"
    - "CORS uses explicit allowlist from ALLOWED_ORIGINS env var"
    - "Session cookies have httpOnly:true, sameSite:strict, secure based on NODE_ENV"
  artifacts:
    - "backend_express/middleware/authMiddleware.js has no x-demo-user block"
    - "backend_express/routes/authRoutes.js has no /dev-login handlers"
    - "backend_express/index.js throws on missing SESSION_SECRET"
---

# Plan 4.1: Remove Demo Auth Bypasses & Harden Session/CORS

<objective>
Remove all demo/dev authentication bypasses and harden session security and CORS configuration.

Purpose: Requirements #1, #7, #8 — eliminate attack surface from demo auth paths and insecure session config.
Output: Clean authMiddleware with no demo bypass, no /dev-login routes, secure session config, strict CORS allowlist.
</objective>

<context>
Load for context:
- backend_express/middleware/authMiddleware.js
- backend_express/routes/authRoutes.js
- backend_express/index.js
- backend_express/.env (for env var reference)
</context>

<tasks>

<task type="auto">
  <name>Remove x-demo-user bypass from authMiddleware and /dev-login from authRoutes</name>
  <files>backend_express/middleware/authMiddleware.js, backend_express/routes/authRoutes.js</files>
  <action>
    In authMiddleware.js: Remove the entire `x-demo-user` block (lines 9-22).
    Keep only the Passport isAuthenticated() check plus the req.session.passport.user fallback.
    Update the 401 message to just: "Unauthorized. Please log in via /api/auth/github"
    
    In authRoutes.js:
    - Remove the GET /dev-login handler entirely
    - Remove the POST /dev-login handler entirely
    - Remove the console.log("OAuth callback hit. Query:", req.query) line
    - Remove the console.log("OAuth successful! req.user profile name:", ...) line
    - Remove the console.log("Session ID set:", req.sessionID) line
    - Remove the console.log("OAuth initiated from origin:", ...) line
    - Keep /github, /github/callback, /logout, /profile routes
    
    AVOID: Removing the /logout and /profile routes — they are legitimate.
    AVOID: Logging session IDs, OAuth codes, or user profile names — these are security violations.
  </action>
  <verify>
    grep -r "x-demo-user" backend_express/ → must return no results
    grep -r "dev-login" backend_express/ → must return no results
    grep -r "demo-token" backend_express/ → must return no results
  </verify>
  <done>
    No x-demo-user references in backend. No /dev-login route. No sensitive console.logs in auth flow.
  </done>
</task>

<task type="auto">
  <name>Harden session config and replace CORS with allowlist</name>
  <files>backend_express/index.js</files>
  <action>
    1. SESSION_SECRET: Change `process.env.SESSION_SECRET || "code-reviewer-secure-session-key"` to:
       ```js
       const sessionSecret = process.env.SESSION_SECRET;
       if (!sessionSecret) {
         console.error("FATAL: SESSION_SECRET environment variable is required");
         process.exit(1);
       }
       ```
       Then use `sessionSecret` in the session config.
    
    2. Session cookie: Change to:
       ```js
       cookie: {
         sameSite: "strict",
         secure: process.env.NODE_ENV === "production",
         httpOnly: true,
         maxAge: 24 * 60 * 60 * 1000
       }
       ```
    
    3. Replace the entire dynamic CORS middleware block with:
       ```js
       import cors from "cors";
       const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",").map(o => o.trim());
       app.use(cors({
         origin: (origin, callback) => {
           if (!origin || allowedOrigins.includes(origin)) {
             callback(null, true);
           } else {
             callback(new Error("CORS: origin not allowed"));
           }
         },
         credentials: true,
         methods: ["GET","POST","PUT","DELETE","OPTIONS"]
       }));
       ```
    
    4. Remove "x-demo-user" from Access-Control-Allow-Headers (it's in the old CORS block, remove it).
    
    5. Remove duplicate route: `app.use("/api", reviewRoutes)` — keep only `app.use("/api/review", reviewRoutes)`.
    
    6. Add helmet: `import helmet from "helmet"; app.use(helmet());` BEFORE the cors middleware.
       Note: helmet must be installed — add it if missing from package.json using: npm install helmet cors
    
    AVOID: Removing the /api/health endpoint — it's needed for monitoring.
    AVOID: Setting secure:true unconditionally — development uses HTTP.
  </action>
  <verify>
    cd backend_express; node -e "import('./index.js')" 2>&1 | head -5
    → Should show "FATAL: SESSION_SECRET" error (since .env may not have it set yet)
    Then: $env:SESSION_SECRET="test"; node index.js → should start on port 5001
  </verify>
  <done>
    Server refuses to start without SESSION_SECRET. CORS only allows origins in ALLOWED_ORIGINS. helmet headers present.
  </done>
</task>

<task type="auto">
  <name>Add SESSION_SECRET and ALLOWED_ORIGINS to .env and update .env.example</name>
  <files>backend_express/.env, backend_express/.env.example (create if missing)</files>
  <action>
    Add to backend_express/.env (append if missing):
    ```
    SESSION_SECRET=dev-local-session-secret-change-in-production
    ALLOWED_ORIGINS=http://localhost:5173
    ```
    
    Create backend_express/.env.example with all required env vars documented:
    ```
    # GitHub OAuth App credentials
    GITHUB_CLIENT_ID=your_github_client_id
    GITHUB_CLIENT_SECRET=your_github_client_secret
    GITHUB_CALLBACK_URL=http://localhost:5001/api/auth/github/callback
    
    # Session security — REQUIRED, no default
    SESSION_SECRET=generate-a-strong-random-secret-here
    
    # CORS — comma-separated list of allowed frontend origins
    ALLOWED_ORIGINS=http://localhost:5173
    
    # Database
    MONGODB_URI=mongodb://localhost:27017/code_reviewer
    
    # Optional: Redis for session store
    REDIS_URL=redis://localhost:6379
    
    # Optional: GitHub App for Check Runs
    GITHUB_APP_ID=
    GITHUB_APP_PRIVATE_KEY_PATH=
    GITHUB_APP_INSTALLATION_ID=
    
    # AI review
    GEMINI_API_KEY=your_gemini_api_key
    
    PORT=5001
    NODE_ENV=development
    ```
    
    AVOID: Committing real secrets — .env is in .gitignore already.
  </action>
  <verify>
    Test-Path backend_express/.env.example → True
    cat backend_express/.env | Select-String "SESSION_SECRET" → should show the value
  </verify>
  <done>
    .env has SESSION_SECRET and ALLOWED_ORIGINS. .env.example documents all required vars.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] `grep -r "x-demo-user" backend_express/` returns nothing
- [ ] `grep -r "dev-login" backend_express/` returns nothing
- [ ] backend_express/index.js contains `process.exit(1)` near SESSION_SECRET check
- [ ] backend_express/index.js uses `cors()` from the cors package (not inline headers)
- [ ] backend_express/.env.example exists with all vars documented
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
- [ ] Changes committed: "security: remove demo auth bypasses, harden session/CORS (#1,#7,#8)"
</success_criteria>

