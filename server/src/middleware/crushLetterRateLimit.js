import { rateLimit } from 'express-rate-limit';

export const createCrushLetterSubmissionLimiter = (options = {}) => rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipFailedRequests: true,
  message: { error: { message: 'Too many Crush Letter submissions. Please try again later.' } },
  ...options,
});

export const crushLetterSubmissionLimiter = createCrushLetterSubmissionLimiter();
