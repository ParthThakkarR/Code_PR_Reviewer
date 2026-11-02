import mongoose from "mongoose";

const repoSchema = new mongoose.Schema({
    owner: String,
    name: String,
    triggeredBy: { type: String, default: "unknown" },

    status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending"
    },

    totalFiles: Number,
    processedFiles: { type: Number, default: 0 },

    results: [
        {
            filename: String,
            score: Number,
            ai_analysis: Object
        }
    ],

    summary: {
        overallScore: Number,
        summary: String,
        top_issues: [String],
        recommendations: [String]
    }
}, { timestamps: true });

export default mongoose.model("Repo", repoSchema);
