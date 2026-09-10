import {
  deleteQuizAttempt,
  getAdminQuizLeaderboard,
} from "../services/quizService.js";

export const leaderboard = async (req, res) =>
  res.json(await getAdminQuizLeaderboard());

export const removeAttempt = async (req, res) => {
  await deleteQuizAttempt(req.params.attemptId);
  res.status(204).end();
};
