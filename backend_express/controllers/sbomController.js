import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import { z } from "zod";

import PRCheck from "../models/prCheck.js";
import {
    parseManifestContent,
    generateCycloneDxXml,
    diffComponents
} from "../services/sbomXmlService.js";
import {
    scanComponentsVulnerabilities,
    evaluateMergeGate,
    makeErrorResult
} from "../services/vulnerabilityService.js";
import {
    fetchBranchManifest,
    mergeGitHubPullRequest,
    listRepoPullRequests
} from "../services/prMergeService.js";

// Load server-side versioned gate policy (Req #4)
const __dirname = dirname(fileURLToPath(import.meta.url));
let GATE_POLICY = { policy: "standard", blockSeverities: ["CRITICAL", "HIGH"], cvssThreshold: 7.5 };
try {
    const policyPath = join(__dirname, "../config/gatePolicy.json");
    GATE_POLICY = JSON.parse(readFileSync(policyPath, "utf8"));
} catch (err) {
    console.warn("Could not load gatePolicy.json, using fallback policy:", err.message);
}

// Zod Input Validation Schema (Req #6)
const checkSbomSchema = z.object({
    owner: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid owner name"),
    repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid repo name"),
    prNumber: z.union([
        z.number().int().positive(),
        z.string().regex(/^\d+$/).transform(Number)
    ]).optional().nullable(),
    prTitle: z.string().max(500).optional().default(""),
    baseBranch: z.string().min(1).max(255).default("main"),
    featureBranch: z.string().min(1).max(255),
    manifestType: z.enum(["auto", "npm", "package.json", "package-lock", "yarn", "pnpm", "poetry", "pipfile-lock", "pip", "requirements.txt"]).optional().default("auto")
});

export const checkPrSbom = async (req, res) => {
    try {
        // Validate input schema
        const parseResult = checkSbomSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: "VALIDATION_ERROR",
                message: "Invalid input parameters",
                details: parseResult.error.flatten()
            });
        }

        const {
            owner,
            repo,
            prNumber = null,
            prTitle = "",
            baseBranch = "main",
            featureBranch,
            manifestType = "auto"
        } = parseResult.data;

        const token = req.user?.accessToken;

        // Fetch manifests strictly on server from GitHub by branch & commit (Req #3)
        const [baseFetched, featureFetched] = await Promise.all([
            fetchBranchManifest(owner, repo, baseBranch, token),
            fetchBranchManifest(owner, repo, featureBranch, token)
        ]);

        // Fail-closed if manifests cannot be fetched (Req #19)
        if (!baseFetched || !baseFetched.content || !featureFetched || !featureFetched.content) {
            return res.status(422).json({
                error: "ERROR",
                status: "ERROR",
                message: `Could not fetch manifests from GitHub for repository ${owner}/${repo}. Ensure base (${baseBranch}) and feature (${featureBranch}) branches exist and contain valid manifest files.`
            });
        }

        const baseContent = baseFetched.content;
        const featureContent = featureFetched.content;
        const baseSha = baseFetched.sha || null;
        const headSha = featureFetched.sha || null;

        // Parse manifests
        const baseComponents = parseManifestContent(baseContent, manifestType);
        const featureComponents = parseManifestContent(featureContent, manifestType);

        // Fail-closed on empty SBOMs (Req #19)
        if (featureComponents.length === 0) {
            return res.status(422).json({
                error: "ERROR",
                status: "ERROR",
                message: "Feature branch SBOM is empty (no dependencies detected). Merge blocked by fail-closed policy."
            });
        }

        // Run vulnerability scan with chunked OSV batching & fail-closed error handling
        let featureVulns = [];
        let baseVulns = [];
        let gateEvaluation;

        try {
            [featureVulns, baseVulns] = await Promise.all([
                scanComponentsVulnerabilities(featureComponents),
                scanComponentsVulnerabilities(baseComponents)
            ]);
            gateEvaluation = evaluateMergeGate(featureVulns, baseVulns, GATE_POLICY);
        } catch (scanErr) {
            console.error("Vulnerability scan failure:", scanErr.message);
            gateEvaluation = makeErrorResult(`Scanner error: ${scanErr.message}. Merge blocked.`);
        }

        // Generate CycloneDX 1.4 XML for Current / Base branch
        const currentXmlSbom = generateCycloneDxXml({
            projectName: repo,
            version: "base",
            branch: baseBranch,
            commit: baseSha || "base-head",
            components: baseComponents,
            vulnerabilities: baseVulns
        });

        // Generate CycloneDX 1.4 XML for Feature branch
        const featureXmlSbom = generateCycloneDxXml({
            projectName: repo,
            version: "feature",
            branch: featureBranch,
            commit: headSha || "feature-head",
            components: featureComponents,
            vulnerabilities: gateEvaluation.vulnerabilities
        });

        // Compute Component Diff
        const componentsDiff = diffComponents(baseComponents, featureComponents);

        const statistics = {
            ...gateEvaluation.statistics,
            totalComponentsCurrent: baseComponents.length,
            totalComponentsFeature: featureComponents.length
        };

        // Persist audit record in MongoDB bound to commit SHAs (Req #24)
        const prCheck = await PRCheck.create({
            owner,
            repo,
            prNumber,
            prTitle,
            baseBranch,
            featureBranch,
            baseSha,
            headSha,
            status: gateEvaluation.status,
            passVulnerabilityCheck: gateEvaluation.passVulnerabilityCheck,
            canMerge: gateEvaluation.canMerge,
            gateReason: gateEvaluation.gateReason,
            blockedReasons: gateEvaluation.blockedReasons,
            remediations: gateEvaluation.remediations,
            currentXmlSbom,
            featureXmlSbom,
            currentComponents: baseComponents,
            featureComponents: featureComponents,
            vulnerabilities: gateEvaluation.vulnerabilities,
            statistics,
            componentsDiff,
            checkedBy: req.user?.profile?.username || req.user?.profile?.login || "developer"
        });

        return res.json({
            success: true,
            checkId: prCheck._id,
            owner,
            repo,
            prNumber,
            prTitle,
            baseBranch,
            featureBranch,
            baseSha,
            headSha,
            status: gateEvaluation.status,
            passVulnerabilityCheck: gateEvaluation.passVulnerabilityCheck,
            canMerge: gateEvaluation.canMerge,
            gateReason: gateEvaluation.gateReason,
            blockedReasons: gateEvaluation.blockedReasons,
            remediations: gateEvaluation.remediations,
            currentXmlSbom,
            featureXmlSbom,
            currentComponents: baseComponents,
            featureComponents: featureComponents,
            vulnerabilities: gateEvaluation.vulnerabilities,
            statistics,
            componentsDiff
        });
    } catch (err) {
        console.error("Error in checkPrSbom:", err);
        return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
};

export const mergePr = async (req, res) => {
    try {
        const { checkId } = req.body;

        if (!checkId || !mongoose.Types.ObjectId.isValid(checkId)) {
            return res.status(400).json({ error: "Invalid checkId parameter" });
        }

        const prCheck = await PRCheck.findById(checkId);
        if (!prCheck) {
            return res.status(404).json({ error: "PR Check report not found. Run SBOM security check first." });
        }

        // STRICT GATE CHECK: If vulnerability check did not pass, STRICTLY BLOCK!
        if (!prCheck.canMerge || !prCheck.passVulnerabilityCheck) {
            return res.status(403).json({
                success: false,
                error: "MERGE BLOCKED: Feature branch failed SBOM vulnerability checks. Critical or High security vulnerabilities must be resolved before this pull request can be merged.",
                status: "MERGE_BLOCKED",
                blockedReasons: prCheck.blockedReasons,
                remediations: prCheck.remediations
            });
        }

        if (prCheck.status === "MERGED") {
            return res.json({
                success: true,
                message: "This Pull Request has already been merged.",
                status: "MERGED",
                mergedAt: prCheck.mergedAt
            });
        }

        if (!prCheck.prNumber) {
            return res.status(422).json({
                error: "CANNOT_MERGE",
                message: "Cannot merge: no PR number is associated with this check."
            });
        }

        // Call GitHub merge API passing expected head sha (Req #25)
        let githubMergeResult;
        try {
            githubMergeResult = await mergeGitHubPullRequest({
                owner: prCheck.owner,
                repo: prCheck.repo,
                pullNumber: prCheck.prNumber,
                sha: prCheck.headSha,
                token: req.user?.accessToken
            });
        } catch (mergeErr) {
            prCheck.status = "MERGE_FAILED";
            await prCheck.save();
            return res.status(502).json({
                success: false,
                error: "GITHUB_MERGE_FAILED",
                message: `GitHub merge API failed: ${mergeErr.message}`,
                status: "MERGE_FAILED"
            });
        }

        // Mark PR merged ONLY after GitHub confirms (Req #25)
        prCheck.status = "MERGED";
        prCheck.mergedAt = new Date();
        prCheck.mergedBy = req.user?.profile?.username || req.user?.profile?.login || "developer";
        await prCheck.save();

        return res.json({
            success: true,
            status: "MERGED",
            message: `Pull Request #${prCheck.prNumber} (${prCheck.featureBranch} → ${prCheck.baseBranch}) was successfully merged!`,
            mergedAt: prCheck.mergedAt,
            mergedBy: prCheck.mergedBy,
            githubResult: githubMergeResult
        });
    } catch (err) {
        console.error("Error in mergePr:", err);
        return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
};

export const getPrCheck = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid check ID format" });
        }
        const prCheck = await PRCheck.findById(id);
        if (!prCheck) return res.status(404).json({ error: "Check not found" });
        return res.json(prCheck);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

export const downloadXml = async (req, res) => {
    try {
        const { id, type } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send("Invalid ID format");
        }
        const prCheck = await PRCheck.findById(id);
        if (!prCheck) return res.status(404).send("Not found");

        const isFeature = type === "feature";
        const xmlContent = isFeature ? prCheck.featureXmlSbom : prCheck.currentXmlSbom;
        const branchName = isFeature ? prCheck.featureBranch : prCheck.baseBranch;
        const filename = `sbom-${prCheck.repo}-${branchName.replace(/[^a-zA-Z0-9_-]/g, "_")}.xml`;

        res.setHeader("Content-Type", "application/xml");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(xmlContent);
    } catch (err) {
        return res.status(500).send(err.message);
    }
};

export const getRepoPrs = async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const token = req.user?.accessToken;
        const prs = await listRepoPullRequests(owner, repo, token);
        return res.json(prs);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
