import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URL || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai-review";
        await mongoose.connect(uri);
        isConnected = true;
        console.log("✅ MongoDB Connected to", uri);
    } catch (err) {
        isConnected = false;
        console.error("❌ MongoDB connection error:", err.message);
        if (process.env.NODE_ENV === "production") {
            console.error("FATAL: Database connection failed in production. Exiting process.");
            process.exit(1);
        }
    }
};

export const isDbConnected = () => {
    return isConnected && mongoose.connection.readyState === 1;
};
