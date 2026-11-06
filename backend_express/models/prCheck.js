import mongoose from "mongoose";

const vulnerabilitySchema = new mongoose.Schema({
    id: { type: String, required: true },
    package: { type: String, required: true },
    version: { type: String, required: true },
    severity: {
        type: String,
        enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"],
        default: "HIGH"
    },
    cvssScore: { type: Number, default: null },
    summary: { type: String, default: "" },
    details: { type: String, default: "" },
    fixedVersion: { type: String, default: "Latest patched version" },
    source: { type: String, default: "OSV / GitHub Advisory" },
    isNewInBranch: { type: Boolean, default: true }
}, { _id: false });

const componentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    version: { type: String, required: true },
    type: { type: String, default: "library" },
    purl: { type: String, default: "" },
    license: { type: String, default: null }
}, { _id: false });

const prCheckSchema = new mongoose.Schema({
    owner: { type: String, required: true },
    repo: { type: String, required: true },
    prNumber: { type: Number, default: null },
    prTitle: { type: String, default: "" },
    baseBranch: { type: String, required: true, default: "main" },
    featureBranch: { type: String, required: true },
    baseSha: { type: String, default: null },
    headSha: { type: String, default: null },
    
    // Gate Decision
    status: {
        type: String,
        enum: ["PENDING", "ALLOWED_TO_MERGE", "MERGE_BLOCKED", "MERGED", "ERROR", "MERGE_FAILED"],
        default: "PENDING"
    },
    passVulnerabilityCheck: { type: Boolean, default: false },
    canMerge: { type: Boolean, default: false },
    gateReason: { type: String, default: "" },
    blockedReasons: [{ type: String }],
    remediations: [{ type: String }],

    // CycloneDX XML SBOMs
    currentXmlSbom: { type: String, default: "" },
    featureXmlSbom: { type: String, default: "" },

    // Component lists
    currentComponents: [componentSchema],
    featureComponents: [componentSchema],

    // Vulnerabilities
    vulnerabilities: [vulnerabilitySchema],
    statistics: {
        totalComponentsCurrent: { type: Number, default: 0 },
        totalComponentsFeature: { type: Number, default: 0 },
        vulnerabilitiesTotal: { type: Number, default: 0 },
        critical: { type: Number, default: 0 },
        high: { type: Number, default: 0 },
        medium: { type: Number, default: 0 },
        low: { type: Number, default: 0 },
        newVulnerabilities: { type: Number, default: 0 }
    },

    componentsDiff: {
        added: [{ type: String }],
        removed: [{ type: String }],
        updated: [{ type: String }],
        unchanged: [{ type: String }]
    },

    mergedAt: { type: Date, default: null },
    mergedBy: { type: String, default: null },
    checkedBy: { type: String, default: "system" }
}, {
    timestamps: true
});

// Indexes for query performance and deduplication
prCheckSchema.index({ owner: 1, repo: 1, prNumber: 1, headSha: 1 });
// 90-day retention TTL index
prCheckSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const PRCheck = mongoose.model("PRCheck", prCheckSchema);

export default PRCheck;
