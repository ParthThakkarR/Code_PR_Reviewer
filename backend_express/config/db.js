import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URL || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai-review";
        await mongoose.connect(uri);
        console.log("✅ MongoDB Connected to", uri);
    } catch (err) {
        console.error("❌ MongoDB connection error:", err.message);
        // Do not crash immediately if Mongo is temporarily offline, to allow server to start
    }
};
