import axios from "axios";
import { getRepoFiles, getFileContent } from "../services/githubAppService.js";

import reviewQueue from "../queue/reviewQueue.js";
import Repo from "../models/repo.js";
import { detectLanguage } from "../utils/language.js";

export const analyzeRepo = async (req, res) => {
    try {
        const { repo, owner } = req.body;

        const files = await getRepoFiles(owner, repo);

        const codeFiles = files.filter(file =>
            file.type === "blob" &&
            (
                file.path.endsWith(".py") ||
                file.path.endsWith(".js") ||
                file.path.endsWith(".ts")
            )
        );

        const repoDoc = await Repo.create({
            owner,
            name: repo,
            status: "processing",
            totalFiles: codeFiles.length,
            triggeredBy: req.user?.profile?.login || "unknown"
        });

        for (const file of codeFiles) {
            const code = await getFileContent(owner, repo, file.path);

            await reviewQueue.add("review", {
                code,
                filename: file.path,
                repoId: repoDoc._id,
                language: detectLanguage(file.path)
            });
        }

        res.json({
            success: true,
            message: "Repo analysis started",
            repoId: repoDoc._id,
            totalFiles: codeFiles.length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

export const getRepoStatus = async (req, res) => {
    try {
        const repo = await Repo.findById(req.params.id);
        if (!repo) return res.status(404).json({ message: "Repo not found" });
        res.json(repo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getRepoSummary = async (req, res) => {
    try {
        const repo = await Repo.findById(req.params.id);
        if (!repo) return res.status(404).json({ message: "Repo not found" });

        res.json({
            status: repo.status,
            summary: repo.summary,
            progress: {
                processed: repo.processedFiles,
                total: repo.totalFiles
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getUserRepos = async (req, res) => {
    try {
        const token = req.user?.accessToken;
        if (!token) return res.status(401).json({ error: "No access token" });

        // Fetch all repos (up to 100) sorted by recently pushed
        const response = await axios.get("https://api.github.com/user/repos", {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
            },
            params: {
                per_page: 100,
                sort: "pushed",
                affiliation: "owner,collaborator,organization_member",
            },
        });

        const repos = response.data.map((r) => ({
            id: r.id,
            name: r.name,
            full_name: r.full_name,
            owner: r.owner.login,
            description: r.description,
            language: r.language,
            private: r.private,
            stargazers_count: r.stargazers_count,
            updated_at: r.pushed_at,
            html_url: r.html_url,
        }));

        res.json(repos);
    } catch (err) {
        console.error("getUserRepos error:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
};
