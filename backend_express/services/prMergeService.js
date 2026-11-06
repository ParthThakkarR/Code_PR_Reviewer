import axios from "axios";
import { getInstallationToken } from "./githubAppService.js";

/**
 * Get branch head commit SHA from GitHub.
 */
export async function getBranchSha(owner, repo, branch, token = null) {
    let authHeader = token ? `Bearer ${token}` : null;
    if (!authHeader && process.env.GITHUB_APP_ID && process.env.GITHUB_INSTALLATION_ID) {
        try {
            const appToken = await getInstallationToken();
            authHeader = `Bearer ${appToken}`;
        } catch { }
    }

    const headers = { Accept: "application/vnd.github+json" };
    if (authHeader) headers.Authorization = authHeader;

    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`;
        const res = await axios.get(url, { headers, timeout: 8000 });
        return res.data?.sha || null;
    } catch {
        return null;
    }
}

/**
 * Fetch a manifest file from a specific branch in a GitHub repository,
 * and record the commit SHA of the branch.
 */
export async function fetchBranchManifest(owner, repo, branch, token = null) {
    let authHeader = token ? `Bearer ${token}` : null;

    if (!authHeader && process.env.GITHUB_APP_ID && process.env.GITHUB_INSTALLATION_ID) {
        try {
            const appToken = await getInstallationToken();
            authHeader = `Bearer ${appToken}`;
        } catch (err) {
            console.warn("Could not obtain GitHub App token:", err.message);
        }
    }

    const headers = {
        Accept: "application/vnd.github.raw+json"
    };
    if (authHeader) {
        headers.Authorization = authHeader;
    }

    // Try lockfiles first (most accurate versions), then manifests
    const candidateFiles = [
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "poetry.lock",
        "Pipfile.lock",
        "package.json",
        "requirements.txt"
    ];

    let branchSha = await getBranchSha(owner, repo, branch, token);

    for (const filename of candidateFiles) {
        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}?ref=${encodeURIComponent(branch)}`;
            const response = await axios.get(url, { headers, timeout: 8000 });
            return {
                filename,
                content: typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2),
                sha: branchSha
            };
        } catch {
            // File not found on this branch or rate limited, try next candidate
        }
    }

    return null;
}

/**
 * Executes real PR merge on GitHub.
 * Pass expected head SHA to prevent race conditions.
 * No simulated merge path exists (Req #25).
 */
export async function mergeGitHubPullRequest({
    owner,
    repo,
    pullNumber,
    sha = null,
    commitTitle = "Merge PR: Passed SBOM Vulnerability Gate",
    commitMessage = "Verified clean CycloneDX XML SBOM with zero blocking vulnerabilities.",
    token = null
}) {
    let authHeader = token ? `Bearer ${token}` : null;

    if (!authHeader && process.env.GITHUB_APP_ID && process.env.GITHUB_INSTALLATION_ID) {
        const appToken = await getInstallationToken();
        authHeader = `Bearer ${appToken}`;
    }

    if (!authHeader) {
        throw new Error("Cannot execute PR merge: GitHub App or user credentials not configured. Merging must be performed directly on GitHub or with credentials.");
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/merge`;
    const payload = {
        commit_title: commitTitle,
        commit_message: commitMessage,
        merge_method: "merge"
    };

    if (sha) {
        payload.sha = sha;
    }

    const response = await axios.put(
        url,
        payload,
        {
            headers: {
                Authorization: authHeader,
                Accept: "application/vnd.github+json"
            },
            timeout: 10000
        }
    );

    if (response.status !== 200 && response.status !== 201) {
        throw new Error(`GitHub merge API returned HTTP ${response.status}: ${JSON.stringify(response.data)}`);
    }

    return {
        merged: true,
        sha: response.data.sha,
        message: response.data.message || "PR successfully merged on GitHub"
    };
}

/**
 * List open pull requests for repository.
 */
export async function listRepoPullRequests(owner, repo, token = null) {
    let authHeader = token ? `Bearer ${token}` : null;

    if (!authHeader && process.env.GITHUB_APP_ID && process.env.GITHUB_INSTALLATION_ID) {
        try {
            const appToken = await getInstallationToken();
            authHeader = `Bearer ${appToken}`;
        } catch {}
    }

    const headers = { Accept: "application/vnd.github+json" };
    if (authHeader) headers.Authorization = authHeader;

    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=30`;
        const res = await axios.get(url, { headers, timeout: 8000 });
        return res.data.map(pr => ({
            number: pr.number,
            title: pr.title,
            baseBranch: pr.base.ref,
            featureBranch: pr.head.ref,
            headSha: pr.head.sha,
            baseSha: pr.base.sha,
            user: pr.user.login,
            htmlUrl: pr.html_url,
            createdAt: pr.created_at
        }));
    } catch {
        return [];
    }
}
