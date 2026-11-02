import axios from "axios";
import { getInstallationToken } from "./githubAppService.js";

export const getContributors = async (owner, repo) => {
    const token = await getInstallationToken();

    let commits = [];
    let page = 1;

    while (true) {
        const res = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/commits`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json"
                },
                params: { per_page: 100, page }
            }
        );

        if (!res.data.length) break;

        commits = commits.concat(res.data);
        if (res.data.length < 100 || commits.length >= 500) break;
        page++;
    }

    const contributorMap = {};

    for (const commit of commits) {
        const author = commit.author?.login || commit.commit?.author?.name || "unknown";
        const avatarUrl = commit.author?.avatar_url || null;
        const commitDate = new Date(commit.commit?.author?.date);
        const message = commit.commit?.message?.split("\n")[0] || "";

        if (!contributorMap[author]) {
            contributorMap[author] = {
                login: author,
                avatarUrl,
                totalCommits: 0,
                lastCommitAt: commitDate,
                lastCommitMessage: message,
                firstCommitAt: commitDate,
                filesChanged: new Set()
            };
        }

        const c = contributorMap[author];
        c.totalCommits++;

        if (commitDate > c.lastCommitAt) {
            c.lastCommitAt = commitDate;
            c.lastCommitMessage = message;
        }
        if (commitDate < c.firstCommitAt) {
            c.firstCommitAt = commitDate;
        }
    }

    try {
        const statsRes = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/stats/contributors`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json"
                }
            }
        );

        if (Array.isArray(statsRes.data)) {
            for (const stat of statsRes.data) {
                const login = stat.author?.login;
                if (login && contributorMap[login]) {
                    contributorMap[login].additions = stat.weeks.reduce((sum, w) => sum + w.a, 0);
                    contributorMap[login].deletions = stat.weeks.reduce((sum, w) => sum + w.d, 0);
                    contributorMap[login].weeklyActivity = stat.weeks
                        .filter(w => w.c > 0)
                        .map(w => ({ week: new Date(w.w * 1000).toISOString().slice(0, 10), commits: w.c }));
                }
            }
        }
    } catch {
        
    }

    const contributors = Object.values(contributorMap).map(c => ({
        ...c,
        filesChanged: c.filesChanged.size,
        daysSinceLastCommit: Math.floor((Date.now() - c.lastCommitAt) / 86400000)
    }));

    contributors.sort((a, b) => b.lastCommitAt - a.lastCommitAt);

    return {
        totalContributors: contributors.length,
        totalCommits: commits.length,
        mostRecentContributor: contributors[0] || null,
        contributors
    };
};
