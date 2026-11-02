import { Queue } from "bullmq";
import IORedis from "ioredis";

let redisAvailable = false;

const connection = new IORedis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy(times) {
        if (times > 5) return null; // stop retry flood when redis not installed
        return Math.min(times * 500, 3000);
    }
});

connection.on("connect", () => {
    redisAvailable = true;
    console.log("✅ Redis connected for BullMQ queue");
});

connection.on("error", (err) => {
    redisAvailable = false;
    // Suppress unhandled exception crash
});

const reviewQueue = new Queue("review-queue", {
    connection
});

reviewQueue.on("error", () => { });

export { redisAvailable, connection };
export default reviewQueue;
