import "./load-env.js";
import "./config/env.js"; // Validates environment configuration on startup (Req #39)

import express from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { randomUUID } from "crypto";

import reviewRoutes from "./routes/reviewRoutes.js";
import repoRoutes from "./routes/repoRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import sbomRoutes from "./routes/sbomRoutes.js";
import { connectDB, isDbConnected } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";
import "./config/passport.js";
import "./workers/reviewWorker.js";

const app = express();
app.set("trust proxy", 1);

// Correlation ID middleware (Req #57)
app.use((req, res, next) => {
    req.id = req.headers["x-request-id"] || randomUUID();
    res.setHeader("x-request-id", req.id);
    next();
});

// Security Headers via Helmet (Req #12)
app.use(helmet({ contentSecurityPolicy: false }));

// Strict CORS Allowlist (Req #8)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",").map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        const isTunnel = origin && (origin.endsWith(".loca.lt") || origin.includes("ngrok"));
        if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== "production" && isTunnel)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS error: Origin ${origin} not allowed by policy`));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization", "x-request-id"]
}));

connectDB();
app.use(express.json({ limit: "2mb" }));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
    logger.error("FATAL: SESSION_SECRET environment variable is required in production.");
    process.exit(1);
}

app.use(session({
    secret: sessionSecret || "secure-code-reviewer-development-secret-key-32chars",
    resave: false,
    saveUninitialized: false,
    cookie: {
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Observability and Health Probes (Req #43)
app.get("/healthz", (req, res) => res.json({ status: "healthy", timestamp: new Date().toISOString() }));
app.get("/readyz", (req, res) => isDbConnected() ? res.json({ status: "ready", db: "connected" }) : res.status(503).json({ status: "not_ready", db: "disconnected" }));
app.get("/api/health", (req, res) => res.json({ status: "healthy", timestamp: new Date().toISOString() }));

// Primary Routes
app.use("/api/review", reviewRoutes);
app.use("/api/repo", repoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sbom", sbomRoutes);

// Versioned /api/v1 Routes (Req #56)
app.use("/api/v1/review", reviewRoutes);
app.use("/api/v1/repo", repoRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/sbom", sbomRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

export default app;
