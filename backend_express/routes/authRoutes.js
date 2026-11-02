import express from "express";
import passport from "passport";

const router = express.Router();

router.get("/github", (req, res, next) => {
    console.log("OAuth initiated from origin:", req.headers.origin);
    next();
}, passport.authenticate("github", { scope: ["repo"] }));

router.get("/github/callback", (req, res, next) => {
    console.log("OAuth callback hit. Query:", req.query);
    next();
}, passport.authenticate("github",
    {
        failureRedirect: "/"
    }),
    (req, res) => {
        console.log("OAuth successful! req.user profile name:", req.user?.profile?.displayName);
        console.log("Session ID set:", req.sessionID);
        res.redirect("http://localhost:5173");
    }
);

router.get("/dev-login", (req, res) => {
    const devUser = {
        profile: {
            id: "123456",
            username: "demo-developer",
            displayName: "Demo Developer",
            login: "demo-developer",
            photos: [{ value: "https://avatars.githubusercontent.com/u/9919?v=4" }]
        },
        accessToken: "demo-access-token"
    };
    req.session.user = devUser;
    req.session.passport = { user: devUser };
    res.redirect("http://localhost:5173");
});

router.post("/dev-login", (req, res) => {
    const devUser = {
        profile: {
            id: "123456",
            username: "demo-developer",
            displayName: "Demo Developer",
            login: "demo-developer",
            photos: [{ value: "https://avatars.githubusercontent.com/u/9919?v=4" }]
        },
        accessToken: "demo-access-token"
    };
    req.session.user = devUser;
    req.session.passport = { user: devUser };
    res.json({ success: true, user: devUser });
});

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
        res.json(user);
    });

export default router;
