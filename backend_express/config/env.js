import { z } from "zod";

const envSchema = z.object({
    PORT: z.coerce.number().default(5001),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters long"),
    MONGO_URI: z.string().default("mongodb://127.0.0.1:27017/ai-review"),
    ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    PYTHON_SERVICE_URL: z.string().default("http://localhost:8000/analyze")
});

let validatedEnv;

try {
    validatedEnv = envSchema.parse(process.env);
} catch (err) {
    if (err instanceof z.ZodError) {
        console.error("❌ Environment configuration validation failed:");
        err.issues.forEach(issue => {
            console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
        });
        if (process.env.NODE_ENV === "production") {
            console.error("FATAL: Exiting due to invalid production configuration.");
            process.exit(1);
        }
    }
    validatedEnv = process.env;
}

export default validatedEnv;
