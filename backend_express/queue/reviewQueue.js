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

connection.on("error", () => {
    redisAvailable = false;
});

// Configure queue jobs with attempts, exponential backoff, and cleanup (Req #35)
const reviewQueue = new Queue("review-queue", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000
        },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 1000 }
    }
});

reviewQueue.on("error", () => { });

export { redisAvailable, connection };
export default reviewQueue;
