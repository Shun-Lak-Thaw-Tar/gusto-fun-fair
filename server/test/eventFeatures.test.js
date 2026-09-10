import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import sharp from "sharp";
import app from "../src/app.js";
import env from "../src/config/env.js";
import EventConfig from "../src/models/EventConfig.js";
import Memory from "../src/models/Memory.js";
import MediaAsset from "../src/models/MediaAsset.js";
import Order from "../src/models/Order.js";
import QuizAttempt from "../src/models/QuizAttempt.js";
import QuizQuestion from "../src/models/QuizQuestion.js";
import SnapSettings from "../src/models/SnapSettings.js";
import User from "../src/models/User.js";
import { mediaStorage } from "../src/services/mediaService.js";
import { isEventActive } from "../src/services/eventService.js";

const uri = process.env.TEST_MONGODB_URI;

test(
  "Letters, Memories, Quiz, privilege isolation, and event-day boundaries",
  { timeout: 120_000 },
  async (t) => {
    if (!uri) throw new Error("Run npm test to use the isolated database");
    await mongoose.connect(uri, {
      dbName: `funfair_event_features_${process.pid}`,
    });
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    await Promise.all(
      Object.values(mongoose.models).map((model) => model.init()),
    );
    const originalSecret = env.jwtSecret;
    env.jwtSecret = "event-features-test-secret";
    t.after(() => {
      env.jwtSecret = originalSecret;
    });
    const objects = new Map();
    t.mock.method(mediaStorage, "put", async (asset, buffer) => {
      objects.set(asset.storageKey, buffer);
    });
    t.mock.method(mediaStorage, "get", async (asset) => ({
      Body: Readable.from([objects.get(asset.storageKey)]),
    }));
    const now = new Date();
    const event = await EventConfig.create({
      configKey: "current",
      eventName: "Feature Test",
      eventDate: now,
      eventTimezone: "Asia/Yangon",
      preorderOpenAt: new Date(now - 86_400_000),
      preorderCloseAt: new Date(now - 3_600_000),
      orderingEnabled: true,
      featureFlags: { memoriesEnabled: true, crushLettersEnabled: true, quizEnabled: true },
    });
    const [user, other, admin] = await User.create([
      {
        name: "Feature User",
        nameNormalized: "feature user",
        passwordHash: "x",
        role: "user",
      },
      {
        name: "Other User",
        nameNormalized: "other user",
        passwordHash: "x",
        role: "user",
      },
      {
        name: "Feature Admin",
        nameNormalized: "feature admin",
        passwordHash: "x",
        role: "admin",
      },
    ]);
    await SnapSettings.create({
      eventId: event._id,
      opensAt: new Date(now - 3_600_000),
      closesAt: new Date(now.getTime() + 3_600_000),
      updatedBy: admin._id,
    });
    const code = "FF-PRIV-FEATURE-ONE";
    const secondCode = "FF-PRIV-FEATURE-TWO";
    await Order.create([
      {
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
        paymentReference: "FF-FEATURE-ONE",
        preorderPrivilegeCode: code,
        reservationExpiresAt: new Date(now.getTime() + 60_000),
      },
      {
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
        paymentReference: "FF-FEATURE-TWO",
        preorderPrivilegeCode: secondCode,
        reservationExpiresAt: new Date(now.getTime() + 60_000),
      },
    ]);
    const questions = [0, 1, 2, 3, 0].map((correctOption, index) => ({
      question: `Question ${index}`,
      options: ["A", "B", "C", "D"],
      correctOption,
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
    const auth = (account) => ({ Authorization: `Bearer ${token(account)}` });
    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer();
    const request = async (
      path,
      { account, method = "GET", json, file, fields = {} } = {},
    ) => {
      const headers = account ? auth(account) : {};
      let body;
      if (file) {
        body = new FormData();
        body.append(
          "image",
          new Blob([file], { type: "image/png" }),
          "photo.png",
        );
        for (const [key, value] of Object.entries(fields))
          body.append(key, value);
      } else if (json !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(json);
      }
      const response = await fetch(base + path, { method, headers, body });
      const contentType = response.headers.get("content-type") || "";
      return {
        status: response.status,
        body: contentType.includes("json")
          ? await response.json()
          : await response.arrayBuffer(),
      };
    };
    const expectStatus = (result, status) => {
      assert.equal(result.status, status, JSON.stringify(result.body));
      return result.body;
    };
    expectStatus(
      await request("/admin/memories/window", {
        account: admin,
        method: "PUT",
        json: {
          opensAt: new Date(now - 3_600_000).toISOString(),
          closesAt: new Date(now.getTime() + 3_600_000).toISOString(),
        },
      }),
      200,
    );
    assert.equal((await request("/memories/window")).body.snaps.status, "OPEN");

    await t.test(
      "event-day helper uses Asia/Yangon calendar boundaries",
      () => {
        const config = {
          eventDate: new Date("2030-09-11T00:00:00.000Z"),
          eventTimezone: "Asia/Yangon",
        };
        assert.equal(
          isEventActive(config, new Date("2030-09-10T17:29:59.999Z")),
          false,
        );
        assert.equal(
          isEventActive(config, new Date("2030-09-10T17:30:00.000Z")),
          true,
        );
        assert.equal(
          isEventActive(config, new Date("2030-09-11T10:00:00.000Z")),
          true,
        );
        assert.equal(
          isEventActive(config, new Date("2030-09-11T17:30:00.000Z")),
          false,
        );
      },
    );

    await t.test(
      "letters require auth, stay pending, and hide author publicly",
      async () => {
        expectStatus(
          await request("/crush-letters", {
            method: "POST",
            json: { recipientName: "A", message: "Hello" },
          }),
          401,
        );
        const submitted = expectStatus(
          await request("/crush-letters", {
            account: user,
            method: "POST",
            json: { recipientName: "A", message: "Hello" },
          }),
          201,
        );
        const pending = await Memory.countDocuments();
        assert.equal(pending, 0);
        assert.equal(
          (await request("/crush-letters")).body.crushLetters.some(
            (item) => item.id === submitted.crushLetter.id,
          ),
          false,
        );
        const approved = expectStatus(
          await request(
            `/admin/crush-letters/${submitted.crushLetter.id}/review`,
            { account: admin, method: "PATCH", json: { decision: "APPROVED" } },
          ),
          200,
        );
        assert.equal("authorUserId" in approved.crushLetter, false);
        const publicLetters = expectStatus(
          await request("/crush-letters"),
          200,
        ).crushLetters;
        assert.equal(publicLetters[0].recipientName, "A");
        assert.equal("authorUserId" in publicLetters[0], false);
      },
    );

    let firstMemoryId;
    await t.test(
      "memory moderation, allowance, privilege isolation, and deletion semantics",
      async () => {
        const first = expectStatus(
          await request("/memories", {
            account: user,
            method: "POST",
            file: png,
            fields: { caption: "first" },
          }),
          201,
        );
        firstMemoryId = first.memory.id;
        assert.equal((await request("/memories")).body.memories.length, 0);
        expectStatus(
          await request(`/admin/memories/${firstMemoryId}/review`, {
            account: admin,
            method: "PATCH",
            json: { decision: "APPROVED" },
          }),
          200,
        );
        assert.equal(
          expectStatus(await request("/memories"), 200).memories.length,
          1,
        );
        expectStatus(
          await request("/memories", {
            account: user,
            method: "POST",
            file: png,
          }),
          409,
        );
        const second = expectStatus(
          await request("/memories", {
            account: user,
            method: "POST",
            file: png,
            fields: { privilegeCode: code },
          }),
          201,
        );
        assert.ok(second.memory.id);
        expectStatus(
          await request("/memories", {
            account: user,
            method: "POST",
            file: png,
            fields: { privilegeCode: code },
          }),
          409,
        );
        expectStatus(
          await request(`/memories/${firstMemoryId}`, {
            account: user,
            method: "DELETE",
          }),
          204,
        );
        expectStatus(
          await request("/memories", {
            account: user,
            method: "POST",
            file: png,
          }),
          409,
        );
        assert.equal(
          (await request("/memories/allowance", { account: user })).body.snaps
            .used,
          2,
        );
        assert.equal(
          (await request("/memories", { account: other })).body.memories.length,
          0,
        );
      },
    );

    await t.test(
      "quiz accepts a shared pre-order code, returns five safe questions, snapshots, and isolates privilege use",
      async () => {
        const sharedValidation = expectStatus(
          await request("/quiz/validate-code", {
            account: other,
            method: "POST",
            json: { code },
          }),
          200,
        );
        assert.equal(sharedValidation.eligible, true);
        const validation = expectStatus(
          await request("/quiz/validate-code", {
            account: user,
            method: "POST",
            json: { code },
          }),
          200,
        );
        assert.equal(validation.eligible, true);
        const started = expectStatus(
          await request("/quiz/start", {
            account: user,
            method: "POST",
            json: { code },
          }),
          201,
        );
        assert.equal(started.questions.length, 5);
        assert.equal(
          started.questions.some((question) => "correctOption" in question),
          false,
        );
        const attempt = await QuizAttempt.findById(started.attemptId).select(
          "+questions.correctOption",
        );
        assert.equal(attempt.questions.length, 5);
        const correctAnswers = attempt.questions.map(
          (question) => question.correctOption,
        );
        assert.equal(correctAnswers.length, 5);
        await QuizQuestion.updateMany(
          {},
          {
            $set: {
              correctOption: 3,
              version: 2,
            },
          },
        );
        const result = expectStatus(
          await request(`/quiz/${started.attemptId}/submit`, {
            account: user,
            method: "POST",
            json: {
              answers: correctAnswers,
              score: 0,
              passed: false,
              reward: "fake",
            },
          }),
          200,
        );
        assert.equal(result.score, 5);
        assert.equal(result.passed, true);
        expectStatus(
          await request(`/quiz/${started.attemptId}/submit`, {
            account: user,
            method: "POST",
            json: { answers: [0, 0, 0, 0, 0] },
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
        const second = expectStatus(
          await request("/quiz/start", {
            account: user,
            method: "POST",
            json: { code: secondCode },
          }),
          201,
        );
        const failed = expectStatus(
          await request(`/quiz/${second.attemptId}/submit`, {
            account: user,
            method: "POST",
            json: { answers: [0, 0, 0, 0, 0] },
          }),
          200,
        );
        assert.equal(failed.passed, false);
        expectStatus(
          await request(`/quiz/result/${started.attemptId}`, {
            account: other,
          }),
          404,
        );
      },
    );
  },
);
