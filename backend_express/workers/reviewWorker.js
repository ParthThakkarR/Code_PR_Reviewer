import { Worker } from "bullmq";
import IORedis from "ioredis";
import { getStaticAnalysis } from "../services/staticService.js";
import { analyzeWithAI } from "../services/aiServices.js";
import Review from "../models/review.js";
import { calculateScore } from "../utils/score.js";
import Repo from "../models/repo.js";
import { generateRepoSummary } from "../services/repoSummaryServices.js";
import { getCache, setCache } from "../services/cacheService.js";
import { generateHash } from "../utils/hash.js";

const connection = new IORedis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
    }
});

connection.on("error", () => { });

const worker = new Worker(
    "review-queue",
    async (job) => {
        const { code, filename, repoId, language } = job.data;

        const cacheKey = generateHash(code);

        const cached = await getCache(cacheKey);

        let staticData, aiData, score;

        if (cached) {
            console.log("Cache hit:", filename);

            staticData = cached.static_analysis;
            aiData = cached.ai_analysis;
            score = cached.score;
        } else {
            console.log("Cache miss:", filename);

            staticData = await getStaticAnalysis(code, language);
            aiData = await analyzeWithAI(code, staticData, language);
            score = calculateScore(aiData);

            await setCache(cacheKey, {
                static_analysis: staticData,
                ai_analysis: aiData,
                score
            });
        }

        const review = await Review.create({
            code,
            language,
            static_analysis: staticData,
            ai_analysis: aiData,
            score
        });

        const updatedRepo = await Repo.findByIdAndUpdate(
            repoId,
            {
                $push: {
                    results: {
                        filename,
                        score,
                        ai_analysis: aiData
                    }
                },
                $inc: { processedFiles: 1 }
            },
            { new: true }
        );

        if (updatedRepo && updatedRepo.processedFiles >= updatedRepo.totalFiles) {
            try {
                const summary = await generateRepoSummary(updatedRepo.results);
                await Repo.findByIdAndUpdate(repoId, {
                    status: "completed",
                    summary: {
                        overallScore: summary.overall_score,
                        summary: summary.summary,
                        top_issues: summary.top_issues,
                        recommendations: summary.recommendations
                    }
                });
            } catch (err) {
                console.error("Failed to generate repo summary:", err.message);
                await Repo.findByIdAndUpdate(repoId, { status: "failed" });
            }
        }

        return review;
    },
    { connection }
);

worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
});

worker.on("failed", async (job, err) => {
    console.error(`Job ${job.id} failed (Attempt ${job.attemptsMade}):`, err.message);

        if (job.attemptsMade >= job.opts?.attempts) {
            console.error(`Job ${job.id} permanently failed`);

            await Review.create({
                code: job.data.code,
                language: job.data.language,
                ai_analysis: {},
                static_analysis: {},
                score: 0,
                error: err.message
            });
        }
    });

worker.on("error", () => { });

export default worker;
