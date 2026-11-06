import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import { z } from "zod";

import PRCheck from "../models/prCheck.js";
import { parseManifestContent, generateCycloneDxXml, diffComponents } from "../services/sbomXmlService.js";
import { scanComponentsVulnerabilities, evaluateMergeGate, makeErrorResult } from "../services/vulnerabilityService.js";
import { fetchBranchManifest, mergeGitHubPullRequest, listRepoPullRequests } from "../services/prMergeService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
let GATE_POLICY = { policy: "standard", blockSeverities: ["CRITICAL", "HIGH"], cvssThreshold: 7.5 };
try {
    GATE_POLICY = JSON.parse(readFileSync(join(__dirname, "../config/gatePolicy.json"), "utf8"));
} catch {}

const checkSchema = z.object({
    owner: z.string().min(1).regex(/^[a-zA-Z0-9_.-]+$/),
    repo: z.string().min(1).regex(/^[a-zA-Z0-9_.-]+$/),
    prNumber: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]).optional().nullable(),
    prTitle: z.string().default(""),
    baseBranch: z.string().default("main"),
    featureBranch: z.string().min(1),
    manifestType: z.string().default("auto")
});

export const checkPrSbom = async (req, res) => {
    try {
        const parsed = checkSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

        const { owner, repo, prNumber = null, prTitle = "", baseBranch = "main", featureBranch, manifestType } = parsed.data;
        const token = req.user?.accessToken;

        const [baseFetched, featFetched] = await Promise.all([
            fetchBranchManifest(owner, repo, baseBranch, token),
            fetchBranchManifest(owner, repo, featureBranch, token)
        ]);

        if (!baseFetched?.content || !featFetched?.content) {
            return res.status(422).json({ error: "ERROR", status: "ERROR", message: `Manifests not found on ${owner}/${repo} branches (${baseBranch}, ${featureBranch}).` });
        }

        const baseComps = parseManifestContent(baseFetched.content, manifestType);
        const featComps = parseManifestContent(featFetched.content, manifestType);

        if (!featComps.length) {
            return res.status(422).json({ error: "ERROR", status: "ERROR", message: "Feature branch SBOM has zero dependencies. Fail-closed." });
        }

        let [featVulns, baseVulns, gate] = [[], [], null];
        try {
            [featVulns, baseVulns] = await Promise.all([scanComponentsVulnerabilities(featComps), scanComponentsVulnerabilities(baseComps)]);
            gate = evaluateMergeGate(featVulns, baseVulns, GATE_POLICY);
        } catch (err) {
            gate = makeErrorResult(`Scanner error: ${err.message}. Merge blocked.`);
        }

        const currentXmlSbom = generateCycloneDxXml({ projectName: repo, version: "base", branch: baseBranch, commit: baseFetched.sha || "base", components: baseComps, vulnerabilities: baseVulns });
        const featureXmlSbom = generateCycloneDxXml({ projectName: repo, version: "feature", branch: featureBranch, commit: featFetched.sha || "head", components: featComps, vulnerabilities: gate.vulnerabilities });
        const componentsDiff = diffComponents(baseComps, featComps);
        const statistics = { ...gate.statistics, totalComponentsCurrent: baseComps.length, totalComponentsFeature: featComps.length };

        const check = await PRCheck.create({
            owner, repo, prNumber, prTitle, baseBranch, featureBranch, baseSha: baseFetched.sha, headSha: featFetched.sha,
            ...gate, currentXmlSbom, featureXmlSbom, currentComponents: baseComps, featureComponents: featComps, statistics, componentsDiff,
            checkedBy: req.user?.profile?.username || "developer"
        });

        return res.json({ success: true, checkId: check._id, ...check.toObject() });
    } catch (err) {
        return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
};

export const mergePr = async (req, res) => {
    try {
        const { checkId } = req.body;
        if (!checkId || !mongoose.Types.ObjectId.isValid(checkId)) return res.status(400).json({ error: "Invalid checkId" });

        const check = await PRCheck.findById(checkId);
        if (!check) return res.status(404).json({ error: "PR Check report not found" });
        if (!check.canMerge || !check.passVulnerabilityCheck) {
            return res.status(403).json({ success: false, status: "MERGE_BLOCKED", error: "Vulnerabilities block merge", blockedReasons: check.blockedReasons });
        }
        if (check.status === "MERGED") return res.json({ success: true, status: "MERGED", message: "Already merged" });
        if (!check.prNumber) return res.status(422).json({ error: "No PR number attached" });

        const ghRes = await mergeGitHubPullRequest({ owner: check.owner, repo: check.repo, pullNumber: check.prNumber, sha: check.headSha, token: req.user?.accessToken });
        check.status = "MERGED";
        check.mergedAt = new Date();
        check.mergedBy = req.user?.profile?.username || "developer";
        await check.save();

        return res.json({ success: true, status: "MERGED", message: `PR #${check.prNumber} merged!`, githubResult: ghRes });
    } catch (err) {
        return res.status(502).json({ success: false, status: "MERGE_FAILED", error: err.message });
    }
};

export const getPrCheck = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid ID" });
    const check = await PRCheck.findById(req.params.id);
    return check ? res.json(check) : res.status(404).json({ error: "Not found" });
};

export const downloadXml = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid ID");
    const check = await PRCheck.findById(req.params.id);
    if (!check) return res.status(404).send("Not found");
    const isF = req.params.type === "feature";
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", `attachment; filename="sbom-${check.repo}-${(isF ? check.featureBranch : check.baseBranch).replace(/[^a-zA-Z0-9_-]/g, "_")}.xml"`);
    return res.send(isF ? check.featureXmlSbom : check.currentXmlSbom);
};

export const getRepoPrs = async (req, res) => {
    try {
        const prs = await listRepoPullRequests(req.params.owner, req.params.repo, req.user?.accessToken);
        return res.json(prs);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
