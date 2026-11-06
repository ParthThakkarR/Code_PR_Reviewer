---
phase: 5
plan: 1
wave: 1
depends_on: []
files_modified:
  - backend_express/services/vulnerabilityService.js
  - backend_express/controllers/sbomController.js
  - backend_express/models/prCheck.js
autonomous: true

must_haves:
  truths:
    - "60-component limit removed — chunked batching processes all components"
    - "Hardcoded vulnerability catalog removed — OSV only"
    - "Scanner errors and empty SBOMs produce ERROR status that blocks merge"
    - "CVSS score parsed from OSV response, not hardcoded to 7.5"
    - "Results bound to baseSha and headSha"
  artifacts:
    - "vulnerabilityService.js has chunked OSV batching (chunks of 50)"
    - "vulnerabilityService.js has no KNOWN_VULNERABILITY_CATALOG"
    - "prCheck.js model has baseSha and headSha fields"
    - "ERROR status blocks canMerge in evaluateMergeGate"
---

# Plan 5.1: Fix Vulnerability Scanning — Remove Limits & Catalog, Add Fail-Closed

<objective>
Fix vulnerability scanning: remove 60-component limit, remove hardcoded catalog, parse real CVSS scores, fail-closed on errors.

Purpose: Requirements #19, #20, #21, #22 — production-grade vuln scanning that processes all components and fails safely.
Output: Chunked OSV batching, real CVSS parsing, ERROR state on scanner failures, SHA binding on results.
</objective>

<context>
Load for context:
- backend_express/services/vulnerabilityService.js
- backend_express/models/prCheck.js
- backend_express/controllers/sbomController.js
</context>

<tasks>

<task type="auto">
  <name>Remove hardcoded catalog, fix OSV batching with chunking and real CVSS parsing</name>
  <files>backend_express/services/vulnerabilityService.js</files>
  <action>
    Rewrite vulnerabilityService.js completely:
    
    1. REMOVE the entire KNOWN_VULNERABILITY_CATALOG array (lines 4-105).
    
    2. Add a chunk helper:
       ```js
       function chunkArray(arr, size) {
         const chunks = [];
         for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
         return chunks;
       }
       ```
    
    3. Rewrite queryOsvBatch to:
       - Process ALL components (no .slice(0, 60))
       - Split into chunks of 50
       - Make one API call per chunk (sequentially to avoid rate limits)
       - Parse CVSS score from OSV response: look at vuln.severity[] array for CVSS_V3 type, or vuln.database_specific?.cvss_score, or vuln.affected[0]?.database_specific?.cvss_score
       - If no score found, set cvssScore to null (NOT 7.5) and severity to what OSV provides
       - Increase timeout to 15000ms per chunk
       - On network error/timeout: THROW the error (do not return empty [])
    
    4. Rewrite scanComponentsVulnerabilities:
       - Call only queryOsvBatch (no catalog merge)
       - Let errors propagate (async function, errors bubble up)
    
    5. Add ERROR evaluation: export a new function `makeErrorResult(message)` that returns:
       ```js
       { passVulnerabilityCheck: false, canMerge: false, status: "ERROR",
         gateReason: message, blockedReasons: [message], remediations: [],
         vulnerabilities: [], statistics: { vulnerabilitiesTotal: 0, critical: 0, high: 0, medium: 0, low: 0, newVulnerabilities: 0 } }
       ```
    
    Full CVSS parsing logic:
    ```js
    function extractCvssScore(vuln) {
      // Try CVSS_V3 severity entry
      for (const sev of (vuln.severity || [])) {
        if (sev.type === "CVSS_V3" && sev.score) {
          const match = sev.score.match(/CVSS:3\.[01]\/.*\/(\d+\.\d+)$/);
          if (match) return parseFloat(match[1]);
          // Try base score from AV vector
        }
      }
      // Try database_specific
      if (vuln.database_specific?.cvss_score) return parseFloat(vuln.database_specific.cvss_score);
      return null;
    }
    ```
    
    AVOID: Returning [] on OSV errors — throw instead so the controller can catch and fail-closed.
    AVOID: Hardcoding cvssScore = 7.5 anywhere.
  </action>
  <verify>
    grep "KNOWN_VULNERABILITY_CATALOG\|slice(0, 60)\|cvss: 7.5\|cvssScore: 7.5" backend_express/services/vulnerabilityService.js → must return nothing
    grep "chunkArray\|makeErrorResult" backend_express/services/vulnerabilityService.js → must show both
  </verify>
  <done>
    No hardcoded catalog. No 60-limit. Real CVSS parsing. makeErrorResult exported. OSV errors throw.
  </done>
</task>

<task type="auto">
  <name>Add baseSha/headSha to model and wire fail-closed ERROR state in controller</name>
  <files>backend_express/models/prCheck.js, backend_express/controllers/sbomController.js</files>
  <action>
    In backend_express/models/prCheck.js, add to the schema:
    ```js
    baseSha: { type: String },
    headSha: { type: String },
    ```
    
    In backend_express/controllers/sbomController.js:
    
    1. Import makeErrorResult: `import { scanComponentsVulnerabilities, evaluateMergeGate, makeErrorResult } from "../services/vulnerabilityService.js";`
    
    2. Wrap the vulnerability scan in try/catch:
       ```js
       let featureVulns, baseVulns, gateEvaluation;
       try {
         [featureVulns, baseVulns] = await Promise.all([
           scanComponentsVulnerabilities(featureComponents),
           scanComponentsVulnerabilities(baseComponents)
         ]);
         gateEvaluation = evaluateMergeGate(featureVulns, baseVulns, GATE_POLICY.policy);
       } catch (scanErr) {
         gateEvaluation = makeErrorResult(`Vulnerability scanner error: ${scanErr.message}. Merge is blocked until scan succeeds.`);
         featureVulns = [];
         baseVulns = [];
       }
       ```
    
    3. Also fail-closed on empty SBOMs — if featureComponents.length === 0:
       ```js
       if (featureComponents.length === 0) {
         return res.status(422).json({ 
           error: "ERROR", 
           status: "ERROR",
           message: "Feature branch SBOM is empty — no components found. Cannot evaluate security gate. Merge blocked."
         });
       }
       ```
    
    4. When saving PRCheck, also pass baseSha and headSha if available (from the fetchBranchManifest response).
       Update fetchBranchManifest calls to capture the commit SHA if the service returns it.
    
    AVOID: Silently swallowing scan errors and returning PASS — always fail-closed.
  </action>
  <verify>
    grep "makeErrorResult\|ERROR.*scanner\|featureComponents.length" backend_express/controllers/sbomController.js → must show all three patterns
    grep "baseSha\|headSha" backend_express/models/prCheck.js → must show both fields
  </verify>
  <done>
    Model has SHA fields. Controller fails closed on scan errors. Empty SBOMs return 422 ERROR.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No KNOWN_VULNERABILITY_CATALOG in vulnerabilityService.js
- [ ] No 60-component slice in queryOsvBatch
- [ ] makeErrorResult is exported and used in controller
- [ ] prCheck.js schema has baseSha and headSha
- [ ] Empty featureComponents returns 422 with ERROR status
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
- [ ] Changes committed: "gate: remove 60-limit and catalog, real CVSS, fail-closed on errors (#19,#20,#21,#22)"
</success_criteria>

