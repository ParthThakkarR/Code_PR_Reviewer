import "./load-env.js";

import express from "express";
import reviewRoutes from "./routes/reviewRoutes.js";
import repoRoutes from "./routes/repoRoutes.js";
import passport from "passport";
import session from "express-session";
import authRoutes from "./routes/authRoutes.js";
import sbomRoutes from "./routes/sbomRoutes.js";
import { connectDB } from "./config/db.js";
import "./config/passport.js";
import "./workers/reviewWorker.js";

const app = express();

app.set("trust proxy", 1);

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin.startsWith("http://localhost") || origin.includes("ngrok-free.dev") || origin.includes("ngrok"))) {
        res.header("Access-Control-Allow-Origin", origin);
    } else if (!origin) {
        res.header("Access-Control-Allow-Origin", "*");
    }
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-demo-user");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

connectDB();

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "code-reviewer-secure-session-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        sameSite: "lax",
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.use("/api", reviewRoutes);
app.use("/api/review", reviewRoutes);
app.use("/api/repo", repoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sbom", sbomRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
