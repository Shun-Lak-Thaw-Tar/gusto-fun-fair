import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../src/app.js";
import env from "../src/config/env.js";
import EventConfig from "../src/models/EventConfig.js";
import Order from "../src/models/Order.js";
import QuizAttempt from "../src/models/QuizAttempt.js";
import QuizQuestion from "../src/models/QuizQuestion.js";
import User from "../src/models/User.js";

const uri = process.env.TEST_MONGODB_URI;

test(
  "Quiz timer enforcement and public leaderboard",
  { timeout: 60_000 },
  async (t) => {
    if (!uri) throw new Error("Run npm test to use the isolated database");
    await mongoose.connect(uri, {
      dbName: `funfair_quiz_leaderboard_${process.pid}`,
    });
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    await Promise.all(
      Object.values(mongoose.models).map((model) => model.init()),
    );
    const originalSecret = env.jwtSecret;
    env.jwtSecret = "quiz-leaderboard-test-secret";
    t.after(() => {
      env.jwtSecret = originalSecret;
    });
    const now = new Date();
    const event = await EventConfig.create({
      configKey: "current",
      eventName: "Quiz Leaderboard Test",
      eventDate: now,
      eventTimezone: "Asia/Yangon",
      preorderOpenAt: new Date(now.getTime() - 86_400_000),
      preorderCloseAt: new Date(now.getTime() - 1_000),
      orderingEnabled: true,
      featureFlags: { quizEnabled: true },
    });
    const questions = Array.from({ length: 8 }, (_, index) => ({
      question: `Leaderboard question ${index}`,
      options: ["A", "B", "C", "D"],
      correctOption: index % 4,
      version: 1,
      isActive: true,
    }));
    await QuizQuestion.create(questions);

    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const token = (account) =>
      jwt.sign({ role: account.role }, env.jwtSecret, {
        subject: String(account._id),
        expiresIn: "10m",
      });
    const request = async (path, { account, method = "GET", json } = {}) => {
      const headers = account
        ? { Authorization: `Bearer ${token(account)}` }
        : {};
      let body;
      if (json !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(json);
      }
      const response = await fetch(base + path, { method, headers, body });
      return { status: response.status, body: await response.json() };
    };
    const expectStatus = (result, status) => {
      assert.equal(result.status, status, JSON.stringify(result.body));
      return result.body;
    };

    let candidateCounter = 0;
    const runAttempt = async ({ elapsedMs, correct }) => {
      candidateCounter += 1;
      const user = await User.create({
        name: `Candidate ${candidateCounter}`,
        nameNormalized: `candidate ${candidateCounter}`,
        passwordHash: "x",
        role: "user",
      });
      const code = `FF-PRIV-CAND-${candidateCounter}`;
      await Order.create({
        eventId: event._id,
        userId: user._id,
        status: "PAYMENT_APPROVED",
        inventoryStatus: "SOLD",
        items: [
          {
            stallId: new mongoose.Types.ObjectId(),
            stallName: "Test Stall",
            foodName: "Test Food",
            quantity: 1,
            unitPrice: 1000,
            subtotal: 1000,
          },
        ],
        totalQuantity: 1,
        totalAmount: 1000,
        paymentReference: `FF-CAND-${candidateCounter}`,
        preorderPrivilegeCode: code,
        reservationExpiresAt: new Date(now.getTime() + 60_000),
      });
      const started = expectStatus(
        await request("/quiz/start", {
          account: user,
          method: "POST",
          json: { code },
        }),
        201,
      );
      const attempt = await QuizAttempt.findById(started.attemptId).select(
        "+questions.correctOption",
      );
      const answers = correct
        ? attempt.questions.map((question) => question.correctOption)
        : attempt.questions.map(
            (question) => (question.correctOption + 1) % 4,
          );
      // Back-date startedAt so the submit call resolves with a controlled elapsed time
      // instead of the test having to actually wait out the real 50s timer.
      attempt.startedAt = new Date(Date.now() - elapsedMs);
      await attempt.save();
      const submitted = expectStatus(
        await request(`/quiz/${started.attemptId}/submit`, {
          account: user,
          method: "POST",
          json: { answers },
        }),
        200,
      );
      return { user, submitted };
    };

    await t.test(
      "Admin can disable Quiz independently of the event day",
      async () => {
        const user = await User.create({
          name: "Toggle Candidate",
          nameNormalized: "toggle candidate",
          passwordHash: "x",
          role: "user",
        });
        const code = "FF-PRIV-TOGGLE";
        await Order.create({
          eventId: event._id,
          userId: user._id,
          status: "PAYMENT_APPROVED",
          inventoryStatus: "SOLD",
          items: [
            {
              stallId: new mongoose.Types.ObjectId(),
              stallName: "Test Stall",
              foodName: "Test Food",
              quantity: 1,
              unitPrice: 1000,
              subtotal: 1000,
            },
          ],
          totalQuantity: 1,
          totalAmount: 1000,
          paymentReference: "FF-TOGGLE",
          preorderPrivilegeCode: code,
          reservationExpiresAt: new Date(now.getTime() + 60_000),
        });
        await EventConfig.updateOne(
          { _id: event._id },
          { "featureFlags.quizEnabled": false },
        );
        expectStatus(
          await request("/quiz/validate-code", {
            account: user,
            method: "POST",
            json: { code },
          }),
          409,
        );
        expectStatus(
          await request("/quiz/start", {
            account: user,
            method: "POST",
            json: { code },
          }),
          409,
        );
        await EventConfig.updateOne(
          { _id: event._id },
          { "featureFlags.quizEnabled": true },
        );
        expectStatus(
          await request("/quiz/validate-code", {
            account: user,
            method: "POST",
            json: { code },
          }),
          200,
        );
      },
    );

    await t.test(
      "a perfect score submitted after the time limit is scored but does not pass",
      async () => {
        const { submitted } = await runAttempt({
          elapsedMs: 60_000,
          correct: true,
        });
        assert.equal(submitted.score, 5);
        assert.equal(submitted.timedOut, true);
        assert.equal(submitted.passed, false);
      },
    );

    await t.test(
      "an imperfect score within the time limit does not pass",
      async () => {
        const { submitted } = await runAttempt({
          elapsedMs: 2_000,
          correct: false,
        });
        assert.equal(submitted.passed, false);
      },
    );

    await t.test(
      "leaderboard is public, ranks by elapsed time ascending, and caps at five",
      async () => {
        // Six passing candidates so the slowest is pushed off the top five.
        const timings = [20_000, 500, 49_000, 5_000, 1_000, 10_000];
        for (const elapsedMs of timings)
          await runAttempt({ elapsedMs, correct: true });

        const board = expectStatus(
          await request("/quiz/leaderboard"),
          200,
        );
        assert.equal(board.leaderboard.length, 5);
        const times = board.leaderboard.map((entry) => entry.elapsedMs);
        assert.deepEqual(
          times,
          [...times].sort((a, b) => a - b),
        );
        assert.equal(times.includes(49_000), false);
        assert.deepEqual(
          board.leaderboard.map((entry) => entry.rank),
          [1, 2, 3, 4, 5],
        );
        assert.ok(board.leaderboard[0].name);
      },
    );
  },
);
