import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    code: String,
    language: String,

    static_analysis: {
        pylint:  mongoose.Schema.Types.Mixed,
        bandit:  mongoose.Schema.Types.Mixed,
        radon:   mongoose.Schema.Types.Mixed
    },

    ai_analysis: {
        bugs:           [mongoose.Schema.Types.Mixed],
        security:       [mongoose.Schema.Types.Mixed],
        performance:    [mongoose.Schema.Types.Mixed],
        best_practices: [mongoose.Schema.Types.Mixed],
        severity_summary: {
            high:   Number,
            medium: Number,
            low:    Number
        }
    },

    score: Number,
    error: String
}, { timestamps: true });

export default mongoose.model("Review", reviewSchema);
