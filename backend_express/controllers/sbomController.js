import PRCheck from "../models/prCheck.js";
import {
    parseManifestContent,
    generateCycloneDxXml,
    diffComponents
} from "../services/sbomXmlService.js";
import {
    scanComponentsVulnerabilities,
    evaluateMergeGate
} from "../services/vulnerabilityService.js";
import {
    fetchBranchManifest,
    mergeGitHubPullRequest,
    listRepoPullRequests
} from "../services/prMergeService.js";

// Clean base manifest
const DEMO_BASE_PACKAGE_JSON = JSON.stringify({
    name: "payment-service",
    version: "1.0.0",
    dependencies: {
        "dotenv": "17.3.1",
        "ms": "2.1.3"
    }
}, null, 2);

// Clean feature branch (0 vulnerabilities -> PASSED -> MERGE ALLOWED)
const DEMO_SAFE_FEATURE_PACKAGE_JSON = JSON.stringify({
    name: "payment-service",
    version: "1.1.0",
    dependencies: {
        "dotenv": "17.3.1",
        "ms": "2.1.3",
        "dayjs": "1.11.13",
        "clsx": "2.1.1"
    }
}, null, 2);

// Insecure feature branch (Contains Critical & High CVEs -> FAILED -> MERGE BLOCKED)
const DEMO_VULNERABLE_FEATURE_PACKAGE_JSON = JSON.stringify({
    name: "payment-service",
    version: "1.1.0",
    dependencies: {
        "dotenv": "17.3.1",
        "ms": "2.1.3",
        "jsonwebtoken": "9.0.0",      // CRITICAL CVE-2022-23529
        "axios": "0.21.1",             // HIGH CVE-2021-3749 ReDoS
        "lodash": "4.17.15"            // HIGH CVE-2020-8203 Prototype Pollution
    }
}, null, 2);

export const checkPrSbom = async (req, res) => {
    try {
        const {
            owner = "org",
            repo = "repository",
            prNumber = null,
            prTitle = "",
            baseBranch = "main",
            featureBranch = "feature/new-module",
            policy = "standard",
            manifestType = "auto",
            testPreset = null
        } = req.body;

        let baseContent = req.body.baseManifest;
        let featureContent = req.body.featureManifest;

        const token = req.user?.accessToken;

        // Fetch from GitHub if configured
        if (!baseContent && owner && repo && baseBranch && token) {
            const fetched = await fetchBranchManifest(owner, repo, baseBranch, token);
            if (fetched) baseContent = fetched.content;
        }

        if (!featureContent && owner && repo && featureBranch && token) {
            const fetched = await fetchBranchManifest(owner, repo, featureBranch, token);
            if (fetched) featureContent = fetched.content;
        }

        // Apply defaults/presets
        if (!baseContent) {
            baseContent = DEMO_BASE_PACKAGE_JSON;
        }

        if (!featureContent) {
            if (testPreset === "vulnerable") {
                featureContent = DEMO_VULNERABLE_FEATURE_PACKAGE_JSON;
            } else {
                featureContent = DEMO_SAFE_FEATURE_PACKAGE_JSON;
            }
        }

        // Parse manifests
        const baseComponents = parseManifestContent(baseContent, manifestType);
        const featureComponents = parseManifestContent(featureContent, manifestType);

        // Run vulnerability scan
        const [featureVulns, baseVulns] = await Promise.all([
            scanComponentsVulnerabilities(featureComponents),
            scanComponentsVulnerabilities(baseComponents)
        ]);

        // Evaluate Merge Gate
        const gateEvaluation = evaluateMergeGate(featureVulns, baseVulns, policy);

        // Generate CycloneDX XML for Current (Base) Feature/Branch
        const currentXmlSbom = generateCycloneDxXml({
            projectName: repo,
            version: "base",
            branch: baseBranch,
            commit: "base-head",
            components: baseComponents,
            vulnerabilities: baseVulns
        });

        // Generate CycloneDX XML for Feature Branch
        const featureXmlSbom = generateCycloneDxXml({
            projectName: repo,
            version: "feature",
            branch: featureBranch,
            commit: "feature-head",
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

        // Persist in MongoDB
        const prCheck = await PRCheck.create({
            owner,
            repo,
            prNumber,
            prTitle,
            baseBranch,
            featureBranch,
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
            checkedBy: req.user?.profile?.login || "developer"
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
        return res.status(500).json({ error: err.message });
    }
};

export const mergePr = async (req, res) => {
    try {
        const { checkId } = req.body;

        let prCheck = null;
        if (checkId) {
            prCheck = await PRCheck.findById(checkId);
        }

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

        let githubMergeResult = null;
        if (prCheck.prNumber && req.user?.accessToken) {
            try {
                githubMergeResult = await mergeGitHubPullRequest({
                    owner: prCheck.owner,
                    repo: prCheck.repo,
                    pullNumber: prCheck.prNumber,
                    token: req.user.accessToken
                });
            } catch (mergeErr) {
                console.warn("GitHub API merge attempt:", mergeErr.message);
            }
        }

        prCheck.status = "MERGED";
        prCheck.mergedAt = new Date();
        prCheck.mergedBy = req.user?.profile?.login || "developer";
        await prCheck.save();

        return res.json({
            success: true,
            status: "MERGED",
            message: `Pull Request #${prCheck.prNumber || ''} (${prCheck.featureBranch} → ${prCheck.baseBranch}) was successfully merged!`,
            mergedAt: prCheck.mergedAt,
            mergedBy: prCheck.mergedBy,
            githubResult: githubMergeResult
        });
    } catch (err) {
        console.error("Error in mergePr:", err);
        return res.status(500).json({ error: err.message });
    }
};

export const getPrCheck = async (req, res) => {
    try {
        const prCheck = await PRCheck.findById(req.params.id);
        if (!prCheck) return res.status(404).json({ error: "Check not found" });
        return res.json(prCheck);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

export const downloadXml = async (req, res) => {
    try {
        const { id, type } = req.params;
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
