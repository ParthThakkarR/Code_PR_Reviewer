---
phase: 5
plan: 2
wave: 2
depends_on: [5.1]
files_modified:
  - backend_express/controllers/sbomController.js
  - backend_express/services/prMergeService.js
autonomous: true

must_haves:
  truths:
    - "Merge passes expected head SHA to GitHub API"
    - "Simulated-merge success path is removed"
    - "Merge only marked as MERGED after GitHub confirms success"
    - "GitHub merge errors are returned as 502 errors, not silent successes"
  artifacts:
    - "mergePr passes sha to mergeGitHubPullRequest"
    - "No code path that marks status=MERGED without GitHub confirmation"
---

# Plan 5.2: Fix PR Merge — Remove Simulated Merge, Pass SHA

<objective>
Fix the PR merge flow: always pass head SHA to GitHub, only mark merged after GitHub confirms.

Purpose: Requirement #25 — merge must be real, bound to commit SHA, confirmed by GitHub.
Output: Secure merge flow that fails if GitHub rejects, with proper error propagation.
</objective>

<context>
Load for context:
- backend_express/controllers/sbomController.js (mergePr function, lines 190-254)
- backend_express/services/prMergeService.js
</context>

<tasks>

<task type="auto">
  <name>Remove simulated merge path and require GitHub confirmation</name>
  <files>backend_express/controllers/sbomController.js</files>
  <action>
    Rewrite the mergePr function:
    
    1. Require prCheck to have a real prNumber — if prCheck.prNumber is null/undefined, return 422:
       ```js
       if (!prCheck.prNumber) {
         return res.status(422).json({ error: "Cannot merge: no PR number associated with this check." });
       }
       ```
    
    2. Require the user to have a token OR the server to have a GitHub App configured.
       For now use req.user profile to verify user is authenticated (isAuthenticated middleware already handles this).
       Use the GitHub App token from prMergeService for the actual merge call.
    
    3. Remove the block that marks prCheck.status = "MERGED" BEFORE calling GitHub API.
       Instead:
       ```js
       let githubMergeResult;
       try {
         githubMergeResult = await mergeGitHubPullRequest({
           owner: prCheck.owner,
           repo: prCheck.repo,
           pullNumber: prCheck.prNumber,
           sha: prCheck.headSha  // pass expected head SHA
         });
       } catch (mergeErr) {
         return res.status(502).json({
           success: false,
           error: "GitHub merge failed: " + mergeErr.message,
           status: "MERGE_FAILED"
         });
       }
       ```
    
    4. ONLY after successful GitHub merge, update the database:
       ```js
       prCheck.status = "MERGED";
       prCheck.mergedAt = new Date();
       prCheck.mergedBy = req.user?.profile?.login;
       await prCheck.save();
       ```
    
    5. Remove the `console.warn("GitHub API merge attempt:", mergeErr.message)` that silently continues after failure.
    
    AVOID: Setting prCheck.status = "MERGED" before GitHub confirms the merge.
    AVOID: Returning success:true if GitHub merge threw an error.
  </action>
  <verify>
    grep "console.warn.*merge\|status.*MERGED.*save\|simulated" backend_express/controllers/sbomController.js → must return nothing for simulated/warn patterns
    grep "sha: prCheck.headSha\|MERGE_FAILED" backend_express/controllers/sbomController.js → must show both
  </verify>
  <done>
    No simulated merge path. GitHub API called first. Status only updated after GitHub confirms.
  </done>
</task>

<task type="auto">
  <name>Update prMergeService to accept and pass SHA to GitHub merge API</name>
  <files>backend_express/services/prMergeService.js</files>
  <action>
    In mergeGitHubPullRequest function, add sha parameter support:
    
    ```js
    export async function mergeGitHubPullRequest({ owner, repo, pullNumber, sha }) {
      // Get installation token (existing GitHub App logic)
      const token = await getInstallationToken();
      
      const body = {
        merge_method: "merge",
        commit_title: `Merge PR #${pullNumber} — SBOM security gate passed`,
        commit_message: `Merged after SBOM vulnerability check passed. Gate enforced by Code_PR_Reviewer.`
      };
      
      // Only include sha if provided — GitHub will verify branch tip matches
      if (sha) {
        body.sha = sha;  // GitHub rejects merge if head SHA doesn't match — race protection
      }
      
      const response = await axios.put(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/merge`,
        body,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
      );
      
      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`GitHub merge API returned ${response.status}: ${JSON.stringify(response.data)}`);
      }
      
      return response.data;
    }
    ```
    
    Also update fetchBranchManifest to return the commit SHA alongside content:
    ```js
    export async function fetchBranchManifest(owner, repo, branch, token) {
      // ... existing GitHub API calls ...
      // Return: { content: "...", sha: "commit-sha-here" }
      // The sha should be the commit SHA of the branch tip
    }
    ```
    
    AVOID: Making merge calls without proper error handling on non-2xx responses.
  </action>
  <verify>
    grep "body.sha = sha\|sha.*GitHub" backend_express/services/prMergeService.js → must show SHA being passed
  </verify>
  <done>
    mergeGitHubPullRequest passes sha to GitHub API. fetchBranchManifest returns sha alongside content.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No simulated merge path in sbomController.js
- [ ] SHA passed to GitHub merge API
- [ ] Merge errors return 502 with MERGE_FAILED status
- [ ] prCheck.status only set to MERGED after GitHub confirms
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
- [ ] Changes committed: "gate: remove simulated merge, pass SHA to GitHub, fail on merge error (#25)"
</success_criteria>

