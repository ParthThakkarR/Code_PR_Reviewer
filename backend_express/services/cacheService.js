import IORedis from "ioredis";

const memoryStore = new Map();
let isRedisReady = false;

const redis = new IORedis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    enableOfflineQueue: false,
    retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
    }
});

redis.on("connect", () => {
    isRedisReady = true;
});

redis.on("error", () => {
    isRedisReady = false;
});

export const getCache = async (key) => {
    if (isRedisReady) {
        try {
            const data = await redis.get(key);
            if (data) return JSON.parse(data);
        } catch {
            // fallback
        }
    }
    return memoryStore.get(key) || null;
};

export const setCache = async (key, value) => {
    memoryStore.set(key, value);
    if (isRedisReady) {
        try {
            await redis.set(key, JSON.stringify(value), "EX", 60 * 60 * 24);
        } catch {
            // fallback
        }
    }
};
