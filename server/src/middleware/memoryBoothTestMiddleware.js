import env from "../config/env.js";

export const markMemoryBoothTest = (req, _res, next) => {
  req.memoryBoothTest = Boolean(
    env.memoryBoothTestKey &&
    req.get("x-memory-booth-test-key") === env.memoryBoothTestKey,
  );
  next();
};
