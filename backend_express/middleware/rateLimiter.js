import rateLimit from "express-rate-limit";

export const aiRateLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 5,             
    message: { message: "Too many requests. Please slow down.", retryAfterSeconds: 60 }
});

export const repoRateLimiter = rateLimit({
    windowMs: 60 * 1000,   
    max: 3,                
    message: { message: "Too many requests. Please slow down.", retryAfterSeconds: 60 }
});
