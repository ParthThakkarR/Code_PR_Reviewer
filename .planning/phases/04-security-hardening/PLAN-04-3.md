---
phase: 4
plan: 3
wave: 2
depends_on: [4.1]
files_modified:
  - backend_express/routes/sbomRoutes.js
  - backend_express/services/aiServices.js
  - backend_express/config/passport.js
  - backend_express/package.json
autonomous: true

must_haves:
  truths:
    - "SBOM download endpoint requires authentication"
    - "Gemini API key sent in header not URL"
    - "GitHub access token NOT stored in session"
    - "Input validation on owner/repo/prNumber with zod"
    - "Per-user rate limiting on SBOM check endpoint"
  artifacts:
    - "sbomRoutes.js has isAuthenticated on download route"
    - "aiServices.js uses x-goog-api-key header"
    - "zod schema validates sbomController inputs"
---

# Plan 4.3: Auth on SBOM Download, Gemini Key Fix, Input Validation

<objective>
Add authentication to SBOM download, fix Gemini API key transport, add input validation with zod.

Purpose: Requirements #2, #9, #10, #11, #13 — close remaining security gaps in routes and services.
Output: Protected download route, secure Gemini API calls, validated inputs, basic rate limiting.
</objective>

<context>
Load for context:
- backend_express/routes/sbomRoutes.js
- backend_express/services/aiServices.js (if exists)
- backend_express/config/passport.js
- backend_express/middleware/authMiddleware.js
- backend_express/middleware/rateLimiter.js (if exists)
</context>

<tasks>

<task type="auto">
  <name>Protect SBOM download route and validate inputs</name>
  <files>backend_express/routes/sbomRoutes.js, backend_express/controllers/sbomController.js</files>
  <action>
    In backend_express/routes/sbomRoutes.js:
    - Import isAuthenticated from authMiddleware
    - Add isAuthenticated middleware to the GET /download/:id/:type route
    - Also add isAuthenticated to the GET /prs/:owner/:repo route if not already there
    
    In backend_express/controllers/sbomController.js, add input validation at the start of checkPrSbom:
    Install zod if not in package.json: run `cd backend_express; npm install zod`
    
    Add validation:
    ```js
    import { z } from "zod";
    
    const checkSbomSchema = z.object({
      owner: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      prNumber: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]).optional().nullable(),
      prTitle: z.string().max(500).optional().default(""),
      baseBranch: z.string().min(1).max(255),
      featureBranch: z.string().min(1).max(255),
      manifestType: z.enum(["auto","npm","package.json","pip","requirements.txt"]).optional().default("auto")
    });
    
    // At top of checkPrSbom handler:
    const parsed = checkSbomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { owner, repo, prNumber, prTitle, baseBranch, featureBranch, manifestType } = parsed.data;
    ```
    
    Also in downloadXml: validate `id` param is a valid MongoDB ObjectId format before querying.
    
    AVOID: Using req.body values directly in URLs or queries without validation.
  </action>
  <verify>
    grep "isAuthenticated" backend_express/routes/sbomRoutes.js → must show on download route
    grep "checkSbomSchema\|z.object" backend_express/controllers/sbomController.js → must show validation
  </verify>
  <done>
    Download requires auth. Inputs are validated with zod before any processing.
  </done>
</task>

<task type="auto">
  <name>Fix Gemini API key transport and remove token from session/logs</name>
  <files>backend_express/services/aiServices.js, backend_express/config/passport.js</files>
  <action>
    In backend_express/services/aiServices.js (or wherever Gemini API is called):
    - Find any URL like `...?key=${GEMINI_API_KEY}` or `?key=${process.env.GEMINI_API_KEY}`
    - Replace with a header: `headers: { "x-goog-api-key": process.env.GEMINI_API_KEY }`
    - Remove the API key from the URL entirely
    - If the file doesn't exist yet, create a stub with this pattern documented
    
    In backend_express/config/passport.js:
    - In the GitHubStrategy done callback, do NOT include `accessToken` in the user object stored in session
    - Change: `return done(null, { profile, accessToken })` to `return done(null, { profile })`
    - Store token only transiently if needed for the immediate API call, not in the session
    - NOTE: This means req.user.accessToken will be undefined after session restoration.
      The merge/check endpoints that need GitHub API calls will need to use the GitHub App token instead.
      For now, add a comment: "// TODO: use GitHub App installation token for server-side GitHub calls"
    
    AVOID: Logging the accessToken anywhere.
    AVOID: Storing secrets in session — sessions persist to storage (memory/Redis/DB).
  </action>
  <verify>
    grep -r "key=\${.*API_KEY\|key=\${.*GEMINI\|?key=" backend_express/ → must return nothing
    grep "accessToken" backend_express/config/passport.js → should only appear in the comment
  </verify>
  <done>
    Gemini key in header. GitHub token not in session. No token logging.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] GET /api/sbom/download/:id/:type has isAuthenticated middleware
- [ ] zod validation on checkPrSbom inputs
- [ ] No `?key=` pattern in aiServices.js
- [ ] No `accessToken` in passport serialized user (passport.js)
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
- [ ] Changes committed: "security: protect download route, fix Gemini key transport, add input validation (#2,#9,#11)"
</success_criteria>

