import express from "express";
import { analyzeRepo, getRepoSummary, getRepoStatus, getUserRepos } from "../controllers/repoController.js";
import { getRepoContributors } from "../controllers/contributorController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { repoRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.get("/user/repos",    isAuthenticated, getUserRepos);
router.post("/analyze-repo", isAuthenticated, repoRateLimiter, analyzeRepo);
router.get("/:id/summary",   isAuthenticated, getRepoSummary);
router.get("/:id/status",    isAuthenticated, getRepoStatus);

router.get("/:owner/:repo/contributors", isAuthenticated, getRepoContributors);

export default router;
