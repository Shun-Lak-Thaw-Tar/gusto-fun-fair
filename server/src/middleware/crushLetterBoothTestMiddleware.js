import env from "../config/env.js";

export const markCrushLetterBoothTest = (req, _res, next) => {
  req.crushLetterBoothTest = Boolean(
    env.crushLetterTestKey &&
    req.get("x-crush-letter-test-key") === env.crushLetterTestKey,
  );
  next();
};
