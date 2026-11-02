import passport from "passport";
import GitHubStrategy from "passport-github2";

const clientID = process.env.GITHUB_CLIENT_ID || "placeholder_github_client_id";
const clientSecret = process.env.GITHUB_CLIENT_SECRET || "placeholder_github_client_secret";

if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn("⚠️  GitHub OAuth credentials not set in .env. OAuth login will not succeed until GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are provided. Dev login is enabled at /api/auth/dev-login.");
}

passport.use(new GitHubStrategy(
    {
        clientID,
        clientSecret,
        callbackURL: process.env.GITHUB_CALLBACK_URL || "/api/auth/github/callback"
    },
    (accessToken, refreshToken, profile, done) => {
        return done(null, {
            profile,
            accessToken
        });
    }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
