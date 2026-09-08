import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import env from "../src/config/env.js";
import Food from "../src/models/Food.js";
import FoodItem from "../src/models/FoodItem.js";
import StallFood from "../src/models/StallFood.js";
import Stall from "../src/models/Stall.js";
import User from "../src/models/User.js";
import EventConfig from "../src/models/EventConfig.js";
import QuizQuestion from "../src/models/QuizQuestion.js";
import stalls from "./data/stalls.js";
import foodItems from "./data/foodItems.js";
import { findAvailableSlug } from "../src/services/stallService.js";
import { migrateLegacyFoodItems } from "../src/services/foodMigrationService.js";

const assertSafeDatabase = () => {
  const match = env.mongoUri.match(
    /^mongodb(?:\+srv)?:\/\/(?:[^@/?]+@)?[^/]+\/([^?]*)/i,
  );
  const databaseName = match?.[1] || "";
  if (
    !databaseName ||
    databaseName === "admin" ||
    databaseName === "local" ||
    databaseName === "config"
  )
    throw new Error("Refusing to seed an unsafe database target");
};

try {
  assertSafeDatabase();
  await connectDatabase();
  for (const stallData of stalls)
    await Stall.findOneAndUpdate(
      { stallName: stallData.stallName },
      stallData,
      { upsert: true, new: true, runValidators: true },
    );
  const savedStalls = await Stall.find({
    stallName: { $in: stalls.map((stall) => stall.stallName) },
  });
  for (const stall of savedStalls) {
    if (!stall.slug)
      await Stall.collection.updateOne(
        { _id: stall._id, slug: { $exists: false } },
        { $set: { slug: await findAvailableSlug(stall.stallName, stall._id) } },
      );
  }
  const stallIds = new Map(
    savedStalls.map((stall) => [stall.stallName, stall._id]),
  );
  await migrateLegacyFoodItems();
  const foodIds = new Map();
  for (const definition of foodItems) {
    const foodKey =
      definition.foodKey ||
      `demo-${definition.stallName}-${definition.name}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
    if (foodIds.has(foodKey)) continue;
    const legacy = await FoodItem.findOne({
      stallId: stallIds.get(definition.stallName),
      name: definition.name,
    });
    let food = legacy
      ? await Food.findOne({ legacyFoodItemId: legacy._id })
      : null;
    if (food && !food.seedKey) {
      food.seedKey = foodKey;
      await food.save();
    }
    food ||= await Food.findOneAndUpdate(
      { seedKey: foodKey },
      {
        $setOnInsert: {
          seedKey: foodKey,
          name: definition.name,
          description: definition.description,
          image: {
            url: `/demo/foods/${definition.name.toLowerCase().replaceAll(" ", "-")}.jpg`,
            storageKey: "",
            provider: "demo-local",
          },
          isActive: true,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    foodIds.set(foodKey, food._id);
  }
  for (const definition of foodItems) {
    const foodKey =
      definition.foodKey ||
      `demo-${definition.stallName}-${definition.name}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
    const stall = savedStalls.find(
      (candidate) => candidate.stallName === definition.stallName,
    );
    await StallFood.findOneAndUpdate(
      { stallId: stall._id, foodId: foodIds.get(foodKey) },
      {
        $setOnInsert: {
          stallId: stall._id,
          foodId: foodIds.get(foodKey),
          eventDayPrice: definition.eventDayPrice,
          discount: definition.discount || stall.discount,
          ticketLimit: definition.ticketLimit,
          reservedTickets: 0,
          soldTickets: 0,
          isAvailable: definition.isAvailable,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
  }
  const demoEvent = {
    configKey: "current",
    eventName: "DEMO Fun Fair 2030",
    eventDate: new Date("2030-02-15T09:00:00+06:30"),
    eventTimezone: "Asia/Yangon",
    preorderOpenAt: new Date("2026-01-01T00:00:00+06:30"),
    preorderCloseAt: new Date("2030-02-14T09:00:00+06:30"),
    orderingEnabled: true,
    kbzAccountName: "DEMO FUN FAIR ACCOUNT",
    kbzAccountNumber: "DEMO-000000000",
    paymentInstructions:
      "DEMO ONLY: include the order payment reference in the KBZ payment note.",
    orderReservationMinutes: 60,
    paymentProofGraceMinutes: 30,
    featureFlags: {
      memoriesEnabled: false,
      eventPageEnabled: false,
      crushLettersEnabled: false,
      quizEnabled: false,
    },
  };
  const demoQuestions = [
    {
      question: "What is the capital city of Myanmar?",
      options: ["Mandalay", "Naypyidaw", "Yangon", "Bago"],
      correctOption: 1,
    },
    {
      question: "Which color is commonly associated with a school fair?",
      options: ["Red", "Blue", "Green", "All of these"],
      correctOption: 3,
    },
    {
      question: "How many sides does a triangle have?",
      options: ["2", "3", "4", "5"],
      correctOption: 1,
    },
    {
      question: "Which item is commonly bought at a food stall?",
      options: ["Food", "Passport", "Laptop", "Passport photo"],
      correctOption: 0,
    },
    {
      question: "What should a digital ticket normally contain?",
      options: [
        "A ticket code",
        "A weather forecast",
        "A password",
        "A bank PIN",
      ],
      correctOption: 0,
    },
    {
      question: "What is Myanmar's most widely spoken language?",
      options: ["Burmese", "Thai", "Khmer", "Lao"],
      correctOption: 0,
    },
    {
      question: "What do preorder discounts usually do to a food's price?",
      options: ["Raise it", "Lower it", "Double it", "Nothing"],
      correctOption: 1,
    },
    {
      question: "Which of these is a common fair-day dessert?",
      options: ["Chocolate brownie", "Raw onion", "Plain rice", "Ice cube"],
      correctOption: 0,
    },
    {
      question: "How many players are on one side of a football team?",
      options: ["9", "10", "11", "12"],
      correctOption: 2,
    },
    {
      question: "What does KBZ refer to at this fair?",
      options: [
        "A payment method",
        "A stall name",
        "A ticket type",
        "A quiz question",
      ],
      correctOption: 0,
    },
    {
      question: "Which season does Thingyan water festival fall in?",
      options: ["Hot season", "Rainy season", "Cold season", "Never"],
      correctOption: 0,
    },
    {
      question: "What is the main purpose of a preorder privilege code?",
      options: [
        "Unlocking bonus fair activities",
        "Paying for food",
        "Redeeming food tickets",
        "Logging into an account",
      ],
      correctOption: 0,
    },
    {
      question: "Which shape has exactly four equal sides?",
      options: ["Triangle", "Square", "Pentagon", "Circle"],
      correctOption: 1,
    },
    {
      question: "What should you do if you finish the quiz early?",
      options: [
        "Keep guessing randomly",
        "Submit your answers",
        "Refresh the page",
        "Close your browser",
      ],
      correctOption: 1,
    },
  ];
  for (const question of demoQuestions)
    await QuizQuestion.findOneAndUpdate(
      { question: question.question },
      { $setOnInsert: question },
      { upsert: true, new: true, runValidators: true },
    );
  await EventConfig.updateOne(
    { configKey: "current" },
    { $setOnInsert: demoEvent },
    { upsert: true, runValidators: true, timestamps: false },
  );
  const adminName = process.env.SEED_ADMIN_NAME?.trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminName && adminPassword) {
    if (adminPassword.length < 8)
      throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters");
    await User.findOneAndUpdate(
      { nameNormalized: adminName.toLocaleLowerCase("en-US") },
      {
        name: adminName,
        nameNormalized: adminName.toLocaleLowerCase("en-US"),
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: "admin",
      },
      { upsert: true, runValidators: true },
    );
    console.log(
      "Optional demo administrator seeded from environment variables",
    );
  }
  console.log(
    `Demo seed complete: ${stalls.length} stalls, ${foodIds.size} foods, ${foodItems.length} stall foods, and current event configuration`,
  );
} catch (error) {
  console.error("Demo seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
