export const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    if (req.session?.passport?.user || req.session?.user) {
        req.user = req.session.passport?.user || req.session.user;
        return next();
    }
    // Allow development demo bypass if demo flag is enabled
    if (req.headers["x-demo-user"] === "true") {
        req.user = {
            profile: {
                id: "123456",
                username: "demo-developer",
                displayName: "Demo Developer",
                login: "demo-developer",
                photos: [{ value: "https://avatars.githubusercontent.com/u/9919?v=4" }]
            },
            accessToken: "demo-token"
        };
        return next();
    }
    return res.status(401).json({ message: "Unauthorized. Please log in via /api/auth/github or /api/auth/dev-login" });
};
