import express from "express";
import passport from "passport";

const router = express.Router();

router.get("/github", passport.authenticate("github", { scope: ["repo"] }));

router.get(
    "/github/callback",
    passport.authenticate("github", { failureRedirect: "/" }),
    (req, res) => {
        const clientRedirect = process.env.ALLOWED_ORIGINS?.split(",")[0]?.trim() || "http://localhost:5173";
        res.redirect(clientRedirect);
    }
);

router.post("/logout", (req, res) => {
    req.logout?.(() => { });
    req.session?.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ success: true, message: "Logged out" });
    });
});

router.get("/profile", (req, res) => {
    const user = req.user || req.session?.passport?.user || req.session?.user;
    if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    // Return safe user profile without exposing any tokens
    res.json({
        profile: user.profile || user
    });
});

export default router;
