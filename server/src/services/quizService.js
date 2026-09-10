import mongoose from "mongoose";
import QuizAttempt from "../models/QuizAttempt.js";
import QuizQuestion from "../models/QuizQuestion.js";
import { assertEventActive, assertQuizEnabled, getCurrentEvent } from "./eventService.js";
import {
  consumePreorderPrivilege,
  findEligibleOrder,
  hasConsumedPrivilege,
} from "./preorderPrivilegeService.js";
import ApiError from "../utils/ApiError.js";

// Grace period on top of the advertised 50s so normal request latency between
// the client's timer hitting zero and this handler receiving it isn't
// mistaken for a timeout.
export const QUIZ_TIME_LIMIT_MS = 50_000;
const QUIZ_TIME_GRACE_MS = 3_000;

const publicQuestions = (questions) =>
  questions.map(({ questionId, version, question, options }) => ({
    questionId,
    version,
    question,
    options,
  }));

export const validateQuizCode = async ({ userId, code }) => {
  const event = await getCurrentEvent();
  assertEventActive(event);
  assertQuizEnabled(event);
  const order = await findEligibleOrder({ userId, eventId: event._id, code });
  const consumed = await hasConsumedPrivilege({
    userId,
    eventId: event._id,
    privilege: "QUIZ",
  });
  return { eligible: !consumed, alreadyUsed: consumed, orderId: order._id };
};

export const startQuiz = async ({ userId, code }) => {
  const event = await getCurrentEvent();
  assertEventActive(event);
  assertQuizEnabled(event);
  return mongoose.connection.transaction(async (session) => {
    const order = await findEligibleOrder({
      userId,
      eventId: event._id,
      code,
      session,
    });
    const existing = await QuizAttempt.findOne({
      userId,
      orderId: order._id,
    }).session(session);
    if (existing)
      throw new ApiError(409, "This pre-order code already has a quiz attempt");
    const questions = await QuizQuestion.aggregate([
      { $match: { isActive: true } },
      { $sample: { size: 5 } },
    ]).session(session);
    if (questions.length !== 5)
      throw new ApiError(
        503,
        "At least five active quiz questions are required",
      );
    await consumePreorderPrivilege({
      userId,
      eventId: event._id,
      code,
      privilege: "QUIZ",
      session,
    });
    const [attempt] = await QuizAttempt.create(
      [
        {
          userId,
          orderId: order._id,
          questions: questions.map((item) => ({
            questionId: item._id,
            version: item.version,
            question: item.question,
            options: item.options,
            correctOption: item.correctOption,
          })),
          reward: {
            type: "NOT_ISSUED",
            message: "Quiz reward is pending final prize configuration.",
          },
        },
      ],
      { session },
    );
    return {
      attemptId: attempt._id,
      questions: publicQuestions(attempt.questions),
    };
  });
};

// -1 marks a question the client never got an answer recorded for (e.g. the
// 50s timer expired before it was reached) — it can never match a
// correctOption (0-3), so it is always scored as wrong.
const buildResults = (attempt) =>
  attempt.questions.map((question, index) => {
    const yourAnswer = attempt.answers[index];
    return {
      questionId: question.questionId,
      question: question.question,
      options: question.options,
      correctOption: question.correctOption,
      yourAnswer,
      correct: question.correctOption === yourAnswer,
    };
  });

export const submitQuiz = async ({ userId, attemptId, answers }) => {
  if (!mongoose.isObjectIdOrHexString(attemptId))
    throw new ApiError(400, "Invalid quiz attempt ID");
  if (
    !Array.isArray(answers) ||
    answers.length !== 5 ||
    answers.some(
      (answer) => !Number.isInteger(answer) || answer < -1 || answer > 3,
    )
  )
    throw new ApiError(
      400,
      "Exactly five option indexes between -1 (unanswered) and 3 are required",
    );
  const result = await mongoose.connection.transaction(async (session) => {
    const attempt = await QuizAttempt.findOne({
      _id: attemptId,
      userId,
    }).session(session);
    if (!attempt) throw new ApiError(404, "Quiz attempt not found");
    if (attempt.submittedAt)
      throw new ApiError(409, "Quiz attempt has already been submitted");
    const score = attempt.questions.reduce(
      (total, question, index) =>
        total + (question.correctOption === answers[index] ? 1 : 0),
      0,
    );
    const submittedAt = new Date();
    const elapsedMs = Math.max(
      0,
      submittedAt.getTime() - attempt.startedAt.getTime(),
    );
    const timedOut = elapsedMs > QUIZ_TIME_LIMIT_MS + QUIZ_TIME_GRACE_MS;
    attempt.answers = answers;
    attempt.score = score;
    attempt.elapsedMs = elapsedMs;
    attempt.timedOut = timedOut;
    attempt.passed = score === 5 && !timedOut;
    attempt.submittedAt = submittedAt;
    await attempt.save({ session });
    return {
      attemptId: attempt._id,
      score,
      passed: attempt.passed,
      timedOut,
      elapsedMs,
      reward: attempt.reward,
      results: buildResults(attempt),
    };
  });
  return result;
};

export const getQuizLeaderboard = async (limit = 10) => {
  const attempts = await QuizAttempt.find({ passed: true })
    .sort({ elapsedMs: 1, submittedAt: 1 })
    .limit(limit)
    .populate("userId", "name")
    .lean();
  return {
    leaderboard: attempts.map((attempt, index) => ({
      rank: index + 1,
      name: attempt.userId?.name || "A fairground guest",
      elapsedMs: attempt.elapsedMs,
      submittedAt: attempt.submittedAt,
    })),
  };
};

export const getQuizResult = async ({ userId, attemptId }) => {
  const attempt = await QuizAttempt.findOne({ _id: attemptId, userId });
  if (!attempt) throw new ApiError(404, "Quiz attempt not found");
  return {
    attemptId: attempt._id,
    score: attempt.score ?? null,
    passed: attempt.passed ?? null,
    timedOut: attempt.timedOut ?? null,
    elapsedMs: attempt.elapsedMs ?? null,
    submittedAt: attempt.submittedAt || null,
    reward: attempt.reward || null,
    results: attempt.submittedAt ? buildResults(attempt) : null,
  };
};
