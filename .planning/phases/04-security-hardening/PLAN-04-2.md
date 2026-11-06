---
phase: 4
plan: 2
wave: 1
depends_on: []
files_modified:
  - frontend/src/pages/Login.jsx
  - frontend/src/AuthContext.jsx
  - backend_express/controllers/sbomController.js
  - backend_express/config/gatePolicy.json
autonomous: true

must_haves:
  truths:
    - "No demo login button in frontend"
    - "No loginDevUser() or devLogin in AuthContext"
    - "testPreset and demo manifests never accepted from request body"
    - "Policy loaded from server-side config file, not from client"
  artifacts:
    - "frontend/src/pages/Login.jsx has no Quick Dev/Demo Login button"
    - "frontend/src/AuthContext.jsx has no loginDevUser function"
    - "backend_express/config/gatePolicy.json exists with standard policy"
    - "sbomController.js reads policy from gatePolicy.json"
---

# Plan 4.2: Remove Frontend Demo Auth & Server-Side Policy Config

<objective>
Remove demo login from frontend and enforce server-side-only policy/manifest loading.

Purpose: Requirements #1, #3, #4 — no client-submitted manifests or policy; policy from versioned server config.
Output: Clean Login.jsx, clean AuthContext.jsx, sbomController.js fetches manifests from GitHub, gatePolicy.json.
</objective>

<context>
Load for context:
- frontend/src/pages/Login.jsx
- frontend/src/AuthContext.jsx
- backend_express/controllers/sbomController.js
</context>

<tasks>

<task type="auto">
  <name>Remove demo login button and loginDevUser from frontend</name>
  <files>frontend/src/pages/Login.jsx, frontend/src/AuthContext.jsx</files>
  <action>
    In frontend/src/pages/Login.jsx:
    - Remove the "Quick Dev/Demo Login" button (any button that calls loginDevUser or navigates to /api/auth/dev-login)
    - Remove any import of loginDevUser or devLogin
    - Keep the "Sign in with GitHub" button and the existing GitHub OAuth flow
    
    In frontend/src/AuthContext.jsx:
    - Remove the `loginDevUser` function entirely
    - Remove any `devLogin` import or axios call to /dev-login
    - Remove `loginDevUser` from the context value object
    - Keep: user state, login/logout functions, isLoading state, fetchUser function
    
    AVOID: Removing legitimate auth functions like logout, the useEffect that checks /profile, etc.
    AVOID: Modifying API call URLs — those are separate concerns.
  </action>
  <verify>
    cd frontend; npm run build 2>&1 | tail -10 → build must succeed with 0 errors
    grep -r "loginDevUser\|devLogin\|dev-login\|Demo Login" frontend/src/ → must return no results
  </verify>
  <done>
    Frontend builds cleanly. No demo login references in frontend/src/.
  </done>
</task>

<task type="auto">
  <name>Create server-side gate policy config and refactor sbomController to use it</name>
  <files>backend_express/config/gatePolicy.json, backend_express/controllers/sbomController.js</files>
  <action>
    Create backend_express/config/gatePolicy.json:
    ```json
    {
      "policy": "standard",
      "blockSeverities": ["CRITICAL", "HIGH"],
      "description": "Standard policy: block on any Critical or High severity vulnerability in the feature branch. Load from this file — never from the client request."
    }
    ```
    
    In backend_express/controllers/sbomController.js:
    
    1. Add at top of file:
       ```js
       import { readFileSync } from "fs";
       import { fileURLToPath } from "url";
       import { dirname, join } from "path";
       const __dirname = dirname(fileURLToPath(import.meta.url));
       const GATE_POLICY = JSON.parse(readFileSync(join(__dirname, "../config/gatePolicy.json"), "utf8"));
       ```
    
    2. Remove ALL demo manifest constants (DEMO_BASE_PACKAGE_JSON, DEMO_SAFE_FEATURE_PACKAGE_JSON, DEMO_VULNERABLE_FEATURE_PACKAGE_JSON).
    
    3. In checkPrSbom, remove `testPreset`, `baseManifest`, `featureManifest`, `policy` from req.body destructuring.
    
    4. Change the body destructuring to only: `{ owner, repo, prNumber, prTitle, baseBranch, featureBranch, manifestType = "auto" }`.
    
    5. Use `GATE_POLICY.policy` instead of the `policy` variable from req.body when calling `evaluateMergeGate`.
    
    6. For manifests: only fetch from GitHub (using the existing fetchBranchManifest calls).
       If fetchBranchManifest returns null/undefined for EITHER branch, return HTTP 422:
       ```js
       if (!baseContent || !featureContent) {
         return res.status(422).json({ 
           error: "ERROR", 
           message: "Could not fetch manifests from GitHub. Ensure the repository and branches exist and you have access.",
           status: "ERROR"
         });
       }
       ```
       This implements fail-closed for missing manifests (req #19).
    
    7. Remove the fallback `if (!baseContent) { baseContent = DEMO_BASE_PACKAGE_JSON; }` block.
    
    AVOID: Accepting manifests from req.body — always fetch server-side from GitHub.
    AVOID: Accepting policy from req.body — always use GATE_POLICY from config file.
  </action>
  <verify>
    Test-Path backend_express/config/gatePolicy.json → True
    grep "testPreset\|DEMO_BASE\|DEMO_SAFE\|DEMO_VULN\|baseManifest\|featureManifest" backend_express/controllers/sbomController.js → must return nothing
    grep "GATE_POLICY" backend_express/controllers/sbomController.js → must return the usage
  </verify>
  <done>
    gatePolicy.json created. sbomController.js reads policy from file. No demo manifests or testPreset in controller.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] `grep -r "loginDevUser\|devLogin" frontend/src/` returns nothing
- [ ] `grep -r "testPreset\|DEMO_" backend_express/` returns nothing
- [ ] backend_express/config/gatePolicy.json exists and is valid JSON
- [ ] frontend npm run build succeeds
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
- [ ] Changes committed: "security: remove frontend demo auth, server-side policy config (#1,#3,#4)"
</success_criteria>

