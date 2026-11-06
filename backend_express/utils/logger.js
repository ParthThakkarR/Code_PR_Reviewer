/**
 * Structured JSON Logger with secret sanitization and correlation ID support (Req #10, #57).
 */

const SENSITIVE_KEYS = new Set([
    "token",
    "accesstoken",
    "password",
    "secret",
    "sessionsecret",
    "key",
    "github_client_secret",
    "gemini_api_key",
    "authorization",
    "cookie"
]);

function maskSensitiveData(data) {
    if (!data || typeof data !== "object") return data;

    if (Array.isArray(data)) {
        return data.map(maskSensitiveData);
    }

    const cleaned = {};
    for (const [k, v] of Object.entries(data)) {
        if (SENSITIVE_KEYS.has(k.toLowerCase())) {
            cleaned[k] = "[REDACTED]";
        } else if (typeof v === "object" && v !== null) {
            cleaned[k] = maskSensitiveData(v);
        } else {
            cleaned[k] = v;
        }
    }
    return cleaned;
}

export const logger = {
    info(message, meta = {}) {
        console.log(JSON.stringify({
            level: "INFO",
            timestamp: new Date().toISOString(),
            message,
            ...maskSensitiveData(meta)
        }));
    },

    warn(message, meta = {}) {
        console.warn(JSON.stringify({
            level: "WARN",
            timestamp: new Date().toISOString(),
            message,
            ...maskSensitiveData(meta)
        }));
    },

    error(message, error = null, meta = {}) {
        console.error(JSON.stringify({
            level: "ERROR",
            timestamp: new Date().toISOString(),
            message,
            errorMessage: error?.message || (typeof error === "string" ? error : undefined),
            ...maskSensitiveData(meta)
        }));
    }
};

export default logger;

