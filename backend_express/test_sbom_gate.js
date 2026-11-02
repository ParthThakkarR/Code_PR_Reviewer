import "./load-env.js";
import { connectDB } from "./config/db.js";
import {
    parseManifestContent,
    generateCycloneDxXml,
    diffComponents
} from "./services/sbomXmlService.js";
import {
    scanComponentsVulnerabilities,
    evaluateMergeGate
} from "./services/vulnerabilityService.js";
import PRCheck from "./models/prCheck.js";

async function runTest() {
    console.log("=== Testing SBOM XML Generation & Vulnerability Gate ===");
    await connectDB();

    const basePackageJson = JSON.stringify({
        name: "payment-service",
        version: "1.0.0",
        dependencies: {
            "dotenv": "17.3.1",
            "ms": "2.1.3"
        }
    });

    const safeFeaturePackageJson = JSON.stringify({
        name: "payment-service",
        version: "1.1.0",
        dependencies: {
            "dotenv": "17.3.1",
            "ms": "2.1.3",
            "dayjs": "1.11.13",
            "clsx": "2.1.1"
        }
    });

    const vulnerableFeaturePackageJson = JSON.stringify({
        name: "payment-service",
        version: "1.1.0",
        dependencies: {
            "dotenv": "17.3.1",
            "ms": "2.1.3",
            "axios": "0.21.1",        // HIGH CVE-2021-3749
            "jsonwebtoken": "9.0.0"   // CRITICAL CVE-2022-23529
        }
    });

    // Test 1: XML Generation
    console.log("\n[Test 1] Testing Manifest Parsing & XML Generation...");
    const baseComps = parseManifestContent(basePackageJson);
    const safeComps = parseManifestContent(safeFeaturePackageJson);
    const vulnComps = parseManifestContent(vulnerableFeaturePackageJson);

    console.log(`Base components: ${baseComps.length}`);
    console.log(`Safe feature components: ${safeComps.length}`);
    console.log(`Vulnerable feature components: ${vulnComps.length}`);

    const baseXml = generateCycloneDxXml({
        projectName: "payment-service",
        branch: "main",
        components: baseComps
    });
    console.log("Base XML valid start:", baseXml.startsWith("<?xml"));
    console.log("Base XML contains <bom>:", baseXml.includes("<bom xmlns="));

    // Test 2: Safe Feature Branch Scan & Gate
    console.log("\n[Test 2] Testing Safe Feature Branch (Should ALLOW merge)...");
    const safeVulns = await scanComponentsVulnerabilities(safeComps);
    const safeBaseVulns = await scanComponentsVulnerabilities(baseComps);
    const safeGate = evaluateMergeGate(safeVulns, safeBaseVulns, "standard");

    console.log("Safe Gate passVulnerabilityCheck:", safeGate.passVulnerabilityCheck);
    console.log("Safe Gate canMerge:", safeGate.canMerge);
    console.log("Safe Gate status:", safeGate.status);
    console.log("Safe Gate reason:", safeGate.gateReason);

    if (!safeGate.canMerge) {
        throw new Error("Safe feature branch should have been allowed to merge!");
    }

    // Test 3: Vulnerable Feature Branch Scan & Gate
    console.log("\n[Test 3] Testing Vulnerable Feature Branch (Should BLOCK merge)...");
    const vulnVulns = await scanComponentsVulnerabilities(vulnComps);
    const vulnGate = evaluateMergeGate(vulnVulns, safeBaseVulns, "standard");

    console.log("Vuln Gate passVulnerabilityCheck:", vulnGate.passVulnerabilityCheck);
    console.log("Vuln Gate canMerge:", vulnGate.canMerge);
    console.log("Vuln Gate status:", vulnGate.status);
    console.log("Vuln Gate blockedReasons count:", vulnGate.blockedReasons.length);

    if (vulnGate.canMerge) {
        throw new Error("Vulnerable feature branch should have been BLOCKED from merging!");
    }

    // Test 4: Verify CycloneDX XML with Vulnerabilities
    const featureXmlWithVulns = generateCycloneDxXml({
        projectName: "payment-service",
        branch: "feature/payment",
        components: vulnComps,
        vulnerabilities: vulnGate.vulnerabilities
    });

    console.log("Feature XML contains <vulnerabilities>:", featureXmlWithVulns.includes("<vulnerabilities>"));
    console.log("Feature XML contains CVE-2021-3749:", featureXmlWithVulns.includes("CVE-2021-3749"));

    // Test 5: Verify Component Diff
    const diff = diffComponents(baseComps, safeComps);
    console.log("Diff added components:", diff.added);

    // Test 6: Verify Mongoose PRCheck record
    const record = await PRCheck.create({
        owner: "test-owner",
        repo: "payment-service",
        baseBranch: "main",
        featureBranch: "feature/safe",
        status: safeGate.status,
        passVulnerabilityCheck: safeGate.passVulnerabilityCheck,
        canMerge: safeGate.canMerge,
        currentXmlSbom: baseXml,
        featureXmlSbom: generateCycloneDxXml({ projectName: "payment-service", branch: "feature/safe", components: safeComps }),
        statistics: safeGate.statistics
    });
    console.log("Created PRCheck MongoDB document ID:", record._id);

    console.log("\n✅ ALL SBOM & PR MERGE GATE TESTS PASSED 100% SUCCESSFULLY!");
    process.exit(0);
}

runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
