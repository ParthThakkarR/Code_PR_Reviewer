import { getStaticAnalysis } from "../services/staticService.js";
import { analyzeWithAI } from "../services/aiServices.js";
import reviewQueue from "../queue/reviewQueue.js";
import { detectLanguage } from "../utils/language.js";

export const reviewCode = async (req, res) => {
    try {
        const { code, language } = req.body;

        if (!code) {
            return res.status(400).json({ message: "Code is required" });
        }

        const lang = language || "python";

        const staticData = await getStaticAnalysis(code, lang);
        const aiResult = await analyzeWithAI(code, staticData, lang);

        res.json({
            success: true,
            static_analysis: staticData,
            ai_analysis: aiResult
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getJobStatus = async (req, res) => {
    const job = await reviewQueue.getJob(req.params.id);

    if (!job) {
        return res.status(404).json({ error: "Job Not Found" });
    }

    const state = await job.getState();

    res.json({
        state,
        result: job.returnvalue
    });
};
