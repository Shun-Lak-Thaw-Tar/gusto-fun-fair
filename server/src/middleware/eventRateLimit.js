import { rateLimit } from "express-rate-limit";

export const quizRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipFailedRequests: true,
  message: {
    error: { message: "Too many Quiz requests. Please try again later." },
  },
});

export const memoryUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipFailedRequests: true,
  message: {
    error: { message: "Too many Memory uploads. Please try again later." },
  },
});

export const memoryReactionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipFailedRequests: true,
  message: {
    error: { message: "Too many Memory reactions. Please try again later." },
  },
});
