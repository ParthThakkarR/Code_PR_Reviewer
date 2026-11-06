export const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    if (req.session?.passport?.user || req.session?.user) {
        req.user = req.session.passport?.user || req.session.user;
        return next();
    }
    return res.status(401).json({ message: "Unauthorized. Please log in via /api/auth/github" });
};
