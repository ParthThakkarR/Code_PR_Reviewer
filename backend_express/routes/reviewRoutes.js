import express from "express";
import { reviewCode, getJobStatus } from "../controllers/reviewController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { aiRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/review",        isAuthenticated, aiRateLimiter, reviewCode);
router.get("/job/:id/status", isAuthenticated, getJobStatus);

export default router;
