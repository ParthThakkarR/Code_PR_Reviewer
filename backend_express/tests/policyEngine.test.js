import test from "node:test";
import assert from "node:assert/strict";
import {
    evaluateMergeGate,
    makeErrorResult,
    normalizeSeverity,
    extractCvssScore
} from "../services/vulnerabilityService.js";

test("Policy Engine: Normalizes severities accurately", () => {
    assert.equal(normalizeSeverity("critical"), "CRITICAL");
    assert.equal(normalizeSeverity("high"), "HIGH");
    assert.equal(normalizeSeverity("moderate"), "MEDIUM");
    assert.equal(normalizeSeverity("medium"), "MEDIUM");
    assert.equal(normalizeSeverity("low"), "LOW");
    assert.equal(normalizeSeverity(null), "UNKNOWN");
});

test("Policy Engine: Extracts numeric CVSS score from vulnerability records", () => {
    const vulnWithScore = {
        severity: [{ type: "CVSS_V3", score: "8.5" }]
    };
    assert.equal(extractCvssScore(vulnWithScore), 8.5);

    const vulnWithDbScore = {
        database_specific: { cvss_score: 9.8 }
    };
    assert.equal(extractCvssScore(vulnWithDbScore), 9.8);

    const vulnWithNoScore = {};
    assert.equal(extractCvssScore(vulnWithNoScore), null);
});

test("Policy Engine: Clean branch with zero vulnerabilities allows PR merge", () => {
    const result = evaluateMergeGate([], []);
    assert.equal(result.canMerge, true);
    assert.equal(result.passVulnerabilityCheck, true);
    assert.equal(result.status, "ALLOWED_TO_MERGE");
    assert.equal(result.blockedReasons.length, 0);
});

test("Policy Engine: Blocks PR on CRITICAL vulnerability", () => {
    const featureVulns = [
        {
            id: "CVE-2022-23529",
            package: "jsonwebtoken",
            version: "9.0.0",
            severity: "CRITICAL",
            cvssScore: 9.8,
            summary: "Remote code execution in jsonwebtoken verification"
        }
    ];

    const result = evaluateMergeGate(featureVulns, []);
    assert.equal(result.canMerge, false);
    assert.equal(result.passVulnerabilityCheck, false);
    assert.equal(result.status, "MERGE_BLOCKED");
    assert.equal(result.statistics.critical, 1);
    assert.match(result.blockedReasons[0], /CRITICAL/);
});

test("Policy Engine: Blocks PR on HIGH vulnerability (CVSS >= 7.5)", () => {
    const featureVulns = [
        {
            id: "CVE-2021-3749",
            package: "axios",
            version: "0.21.1",
            severity: "HIGH",
            cvssScore: 7.5,
            summary: "ReDoS vulnerability in axios"
        }
    ];

    const result = evaluateMergeGate(featureVulns, [], { policy: "standard", cvssThreshold: 7.5 });
    assert.equal(result.canMerge, false);
    assert.equal(result.status, "MERGE_BLOCKED");
    assert.equal(result.statistics.high, 1);
});

test("Policy Engine: Delta mode allows pre-existing base branch CVEs and blocks only new PR CVEs", () => {
    const preExistingVuln = {
        id: "CVE-2020-8203",
        package: "lodash",
        version: "4.17.15",
        severity: "HIGH",
        cvssScore: 7.4
    };

    const newPrVuln = {
        id: "CVE-2022-23529",
        package: "jsonwebtoken",
        version: "9.0.0",
        severity: "CRITICAL",
        cvssScore: 9.8
    };

    // Scenario A: Only pre-existing CVE present in feature branch under delta mode -> ALLOWED
    const resultPreExistingOnly = evaluateMergeGate([preExistingVuln], [preExistingVuln], { policy: "new_only", deltaOnly: true });
    assert.equal(resultPreExistingOnly.canMerge, true);

    // Scenario B: New CVE introduced in feature branch -> BLOCKED
    const resultWithNew = evaluateMergeGate([preExistingVuln, newPrVuln], [preExistingVuln], { policy: "new_only", deltaOnly: true });
    assert.equal(resultWithNew.canMerge, false);
    assert.equal(resultWithNew.statistics.newVulnerabilities, 1);
});

test("Policy Engine: Scanner error creates explicit fail-closed ERROR state", () => {
    const errorResult = makeErrorResult("OSV Database API timed out after 15000ms");
    assert.equal(errorResult.canMerge, false);
    assert.equal(errorResult.passVulnerabilityCheck, false);
    assert.equal(errorResult.status, "ERROR");
    assert.match(errorResult.gateReason, /timed out/);
});
