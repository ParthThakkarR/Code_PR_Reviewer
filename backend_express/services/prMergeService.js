import axios from "axios";
import { getInstallationToken } from "./githubAppService.js";

/**
 * Fetch a manifest file from a specific branch in a GitHub repository.
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

    // Try package.json first, then requirements.txt
    const candidateFiles = ["package.json", "requirements.txt", "package-lock.json"];
    for (const filename of candidateFiles) {
        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}?ref=${encodeURIComponent(branch)}`;
            const response = await axios.get(url, { headers, timeout: 8000 });
            return {
                filename,
                content: typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2)
            };
        } catch (err) {
            // File not found on this branch or rate limited, try next candidate
        }
    }

    return null;
}

/**
 * Executes PR merge on GitHub if credentials available.
 */
export async function mergeGitHubPullRequest({
    owner,
    repo,
    pullNumber,
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
        return {
            merged: true,
            simulated: true,
            message: "Simulated PR merge successful (No live GitHub OAuth token configured)."
        };
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/merge`;
    const response = await axios.put(
        url,
        {
            commit_title: commitTitle,
            commit_message: commitMessage,
            merge_method: "merge"
        },
        {
            headers: {
                Authorization: authHeader,
                Accept: "application/vnd.github+json"
            }
        }
    );

    return {
        merged: true,
        sha: response.data.sha,
        message: response.data.message || "PR successfully merged"
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
            user: pr.user.login,
            htmlUrl: pr.html_url,
            createdAt: pr.created_at
        }));
    } catch (err) {
        return [];
    }
}

