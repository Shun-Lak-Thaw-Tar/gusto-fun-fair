import env from "../config/env.js";

export const markQuizTest = (req, _res, next) => {
  req.quizTest = Boolean(
    env.quizTestKey && req.get("x-quiz-test-key") === env.quizTestKey,
  );
  next();
};
