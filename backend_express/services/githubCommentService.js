/**
 * Generates automated PR comment markdown with SBOM vulnerability audit findings (Req #64).
 */
export function generatePrCommentMarkdown({
    repo,
    prNumber,
    baseBranch,
    featureBranch,
    headSha,
    gateEvaluation,
    statistics = {}
}) {
    const isPassed = gateEvaluation.passVulnerabilityCheck && gateEvaluation.canMerge;
    const banner = isPassed
        ? "### 🛡️ SBOM Security Gate: PASSED ✅\n\nAll automated dependency vulnerability checks passed. No blocking CVEs detected."
        : "### 🚨 SBOM Security Gate: MERGE BLOCKED ❌\n\nThis pull request introduces or contains security vulnerabilities that violate gate policy. Critical or High severity dependencies must be remediated before this branch can be merged.";

    let comment = `${banner}\n\n`;

    comment += `| Metric | Count |\n`;
    comment += `| :--- | :--- |\n`;
    comment += `| **Gate Decision** | **${gateEvaluation.status}** |\n`;
    comment += `| Total Feature Components | ${statistics.totalComponentsFeature || 0} |\n`;
    comment += `| Total Base Components | ${statistics.totalComponentsCurrent || 0} |\n`;
    comment += `| Critical Severity CVEs | **${statistics.critical || 0}** |\n`;
    comment += `| High Severity CVEs | **${statistics.high || 0}** |\n`;
    comment += `| New Vulnerabilities in PR | **${statistics.newVulnerabilities || 0}** |\n\n`;

    if (!isPassed && gateEvaluation.blockedReasons?.length > 0) {
        comment += `#### ⚠️ Blocking Security Findings\n\n`;
        gateEvaluation.blockedReasons.forEach(reason => {
            comment += `- ${reason}\n`;
        });
        comment += `\n`;
    }

    if (gateEvaluation.remediations?.length > 0) {
        comment += `#### 💡 Recommended Remediations\n\n`;
        gateEvaluation.remediations.forEach(rem => {
            comment += `- ${rem}\n`;
        });
        comment += `\n`;
    }

    comment += `---\n`;
    comment += `*Commit SHA: \`${headSha || "HEAD"}\` | CycloneDX 1.4 XML SBOM generated & verified by [Code_PR_Reviewer](https://github.com/ParthThakkarR/Code_PR_Reviewer).*`;

    return comment;
}
