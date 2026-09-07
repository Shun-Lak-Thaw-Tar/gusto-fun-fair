import { rateLimit } from 'express-rate-limit';
import ApiError from '../utils/ApiError.js';
import { receiveImage } from './uploadMiddleware.js';

// One backend process on the planned 2 GiB EC2 instance. These are admission
// limits, not a queue: rejected uploads never enter Multer or Sharp.
export const PROOF_UPLOAD_LIMITS = Object.freeze({
  concurrent: 2,
  attemptsPerMinute: 12,
  attemptsPerQuarterHour: 60,
  receiveTimeoutMs: 180_000,
  retryAfterSeconds: 5,
});

const retryError = (res, status, code, message, seconds) => {
  res.set('Retry-After', String(seconds));
  return new ApiError(status, message, { code, retryAfterSeconds: seconds });
};

export const createProofUploadRateLimiter = ({ windowMs, limit }) => rateLimit({
  windowMs,
  limit,
  keyGenerator: req => String(req.user._id),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Count validation failures too, but refund capacity/duplicate-in-flight
  // responses. Students should not be penalised because the server is busy.
  skipFailedRequests: true,
  requestWasSuccessful: (_req, res) => !res.locals.proofUploadNotAttempt,
  handler: (req, res, next) => {
    const seconds = Math.max(1, Math.ceil(((req.rateLimit.resetTime?.getTime() || Date.now() + windowMs) - Date.now()) / 1000));
    next(retryError(res, 429, 'PROOF_UPLOAD_RATE_LIMITED', 'You have tried several uploads recently. Please wait a little before sending your receipt again.', seconds));
  },
});

export const proofUploadRateLimiters = [
  createProofUploadRateLimiter({ windowMs: 60_000, limit: PROOF_UPLOAD_LIMITS.attemptsPerMinute }),
  createProofUploadRateLimiter({ windowMs: 15 * 60_000, limit: PROOF_UPLOAD_LIMITS.attemptsPerQuarterHour }),
];

export const createProofUploadHandler = ({ prepare, submit, receive = receiveImage, maxConcurrent = PROOF_UPLOAD_LIMITS.concurrent, receiveTimeoutMs = PROOF_UPLOAD_LIMITS.receiveTimeoutMs }) => {
  let active = 0;
  const accounts = new Set();
  return async (req, res, next) => {
    const account = String(req.user._id);
    if (accounts.has(account)) {
      res.locals.proofUploadNotAttempt = true;
      return next(retryError(res, 429, 'PROOF_UPLOAD_IN_PROGRESS', 'A receipt is already being uploaded for your account. Please wait, then refresh the order status.', PROOF_UPLOAD_LIMITS.retryAfterSeconds));
    }
    if (active >= maxConcurrent) {
      res.locals.proofUploadNotAttempt = true;
      return next(retryError(res, 503, 'PROOF_UPLOAD_BUSY', 'Receipt uploads are busy right now. Please try again in a few seconds.', PROOF_UPLOAD_LIMITS.retryAfterSeconds));
    }
    active += 1;
    accounts.add(account);
    try {
      await prepare(req);
      if (req.aborted || res.destroyed) return;
      // Closing an unfinished request makes Multer destroy its parser and
      // discard pending buffers. Keep the slot until its callback completes.
      const timer = setTimeout(() => req.destroy(new Error('Receipt upload timed out')), receiveTimeoutMs);
      timer.unref();
      try {
        await new Promise((resolve, reject) => {
          receive(req, res, error => error ? reject(error) : resolve());
        });
      } finally { clearTimeout(timer); }
      if (req.aborted || res.destroyed) return;
      await submit(req, res);
    } catch (error) {
      if (!res.destroyed) next(error);
    } finally {
      // Do not release on response/socket close: Sharp or R2 may still be
      // processing an upload after the client disconnects.
      delete req.file;
      active -= 1;
      accounts.delete(account);
    }
  };
};
