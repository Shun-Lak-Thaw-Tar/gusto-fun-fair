import { createHash } from 'node:crypto';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

// A generous shared-IP ceiling accommodates students using campus Wi-Fi.
// Tighter limits isolate repeated attempts at one name from one IP/subnet.
export const AUTH_LIMITS = Object.freeze({
  ipAttempts: 600, ipWindowMs: 5 * 60_000,
  loginFailures: 15, registrationAttempts: 5, accountWindowMs: 15 * 60_000,
});

const accountKey = req => {
  const name = typeof req.body?.name === 'string'
    ? req.body.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US').slice(0, 50)
    : '';
  const digest = createHash('sha256').update(name).digest('hex');
  return `${ipKeyGenerator(req.ip)}:${digest}`;
};

const limiter = (options, message) => rateLimit({
  standardHeaders: 'draft-8', legacyHeaders: false,
  ...options,
  handler: (req, res) => {
    const seconds = Math.max(1, Math.ceil(((req.rateLimit.resetTime?.getTime() || Date.now() + options.windowMs) - Date.now()) / 1000));
    res.set('Retry-After', String(seconds));
    res.status(429).json({ error: { message, details: { code: 'AUTH_RATE_LIMITED', retryAfterSeconds: seconds } } });
  },
});

export const createAuthLimiters = (settings = AUTH_LIMITS) => ({
  sharedIp: limiter({ windowMs: settings.ipWindowMs, limit: settings.ipAttempts },
    'There have been many sign-in or registration attempts from this connection. Please wait a few minutes and try again.'),
  login: limiter({ windowMs: settings.accountWindowMs, limit: settings.loginFailures, keyGenerator: accountKey, skipSuccessfulRequests: true },
    'Too many unsuccessful sign-in attempts for this name from your connection. Please wait up to 15 minutes and try again.'),
  register: limiter({ windowMs: settings.accountWindowMs, limit: settings.registrationAttempts, keyGenerator: accountKey },
    'Several registration attempts were made for this name from your connection. If you already registered, please sign in. Otherwise, wait up to 15 minutes and try again.'),
});

export const authLimiters = createAuthLimiters();
