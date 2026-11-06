import passport from "passport";
import GitHubStrategy from "passport-github2";

const clientID = process.env.GITHUB_CLIENT_ID || "placeholder_github_client_id";
const clientSecret = process.env.GITHUB_CLIENT_SECRET || "placeholder_github_client_secret";

if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn("⚠️  GitHub OAuth credentials not set in .env. OAuth login will not succeed until GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are provided.");
}

passport.use(new GitHubStrategy(
    {
        clientID,
        clientSecret,
        callbackURL: process.env.GITHUB_CALLBACK_URL || "/api/auth/github/callback",
        scope: ["read:user", "user:email", "repo"]
    },
    (accessToken, refreshToken, profile, done) => {
        // Do not store plain access token in persistent session object (Req #9)
        // Profile contains id, username, displayName, photos, emails
        return done(null, {
            profile: {
                id: profile.id,
                username: profile.username,
                displayName: profile.displayName || profile.username,
                photos: profile.photos
            }
        });
    }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
