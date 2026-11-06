import express from "express";
import {
    checkPrSbom,
    mergePr,
    getPrCheck,
    downloadXml,
    getRepoPrs
} from "../controllers/sbomController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/check", isAuthenticated, checkPrSbom);
router.post("/merge", isAuthenticated, mergePr);
router.get("/check/:id", isAuthenticated, getPrCheck);
router.get("/download/:id/:type", isAuthenticated, downloadXml);
router.get("/prs/:owner/:repo", isAuthenticated, getRepoPrs);

export default router;
