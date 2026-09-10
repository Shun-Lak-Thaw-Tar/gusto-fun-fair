import { z } from "zod";
import ApiError from "../utils/ApiError.js";
import {
  getQuizLeaderboard,
  getQuizResult,
  provisionQuizTestCode,
  startQuiz,
  submitQuiz,
  validateQuizCode,
} from "../services/quizService.js";

const codeSchema = z
  .object({ code: z.string().trim().min(1).max(100) })
  .strict();
const answersSchema = z.object({
  answers: z.array(z.number().int().min(-1).max(3)).length(5),
});

export const validateCode = async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "A pre-order code is required");
  res.json(
    await validateQuizCode({ userId: req.user._id, code: parsed.data.code }),
  );
};

export const beginQuiz = async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "A pre-order code is required");
  res
    .status(201)
    .json(await startQuiz({ userId: req.user._id, code: parsed.data.code }));
};

export const submit = async (req, res) => {
  const parsed = answersSchema.safeParse(req.body);
  if (!parsed.success)
    throw new ApiError(400, "Exactly five answers are required");
  res.json(
    await submitQuiz({
      userId: req.user._id,
      attemptId: req.params.attemptId,
      answers: parsed.data.answers,
    }),
  );
};

export const result = async (req, res) =>
  res.json(
    await getQuizResult({
      userId: req.user._id,
      attemptId: req.params.attemptId,
    }),
  );

export const leaderboard = async (req, res) =>
  res.json(await getQuizLeaderboard());

export const testProvisionCode = async (req, res) => {
  if (!req.quizTest) throw new ApiError(404, "Not found");
  res.json(await provisionQuizTestCode({ userId: req.user._id }));
};
