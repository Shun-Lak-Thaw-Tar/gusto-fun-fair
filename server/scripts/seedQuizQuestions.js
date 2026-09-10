import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import QuizQuestion from "../src/models/QuizQuestion.js";

// questions.txt lives one directory above server/, alongside the other repo folders.
const questionsPath = resolve(
  fileURLToPath(new URL("../../", import.meta.url)),
  "questions.txt",
);

const parseQuestions = (raw) => {
  const blocks = raw
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter((block) => /^\d+\./.test(block));

  return blocks.map((block) => {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const questionLine = lines[0].replace(/^\d+\.\s*/, "").trim();
    const optionLines = lines.filter((line) => /^\([A-D]\)/.test(line));
    if (optionLines.length !== 4)
      throw new Error(`Expected 4 options for question: "${questionLine}"`);
    const options = optionLines.map((line) =>
      line.replace(/^\([A-D]\)\s*/, "").trim(),
    );
    const answerLine = lines.find((line) => /^Ans\s*:/i.test(line));
    if (!answerLine)
      throw new Error(`Missing "Ans:" line for question: "${questionLine}"`);
    const answerValue = answerLine.replace(/^Ans\s*:/i, "").trim();

    let correctOption = "ABCD".indexOf(answerValue.toUpperCase());
    if (correctOption === -1)
      correctOption = options.findIndex(
        (option) => option.toLowerCase() === answerValue.toLowerCase(),
      );
    if (correctOption === -1)
      throw new Error(
        `Could not resolve answer "${answerValue}" to an option (A-D or exact option text) for question: "${questionLine}"`,
      );

    return { question: questionLine, options, correctOption };
  });
};

try {
  const raw = readFileSync(questionsPath, "utf8");
  const parsed = parseQuestions(raw);
  if (parsed.length < 5)
    throw new Error(
      `Only found ${parsed.length} questions in questions.txt; at least 5 are required to run the quiz`,
    );

  await connectDatabase();
  const operations = parsed.map(({ question, options, correctOption }) => ({
    updateOne: {
      filter: { question },
      update: {
        $set: { options, correctOption, isActive: true },
        $setOnInsert: { version: 1 },
      },
      upsert: true,
    },
  }));
  const result = await QuizQuestion.bulkWrite(operations);
  console.log(
    `Quiz questions seeded: ${parsed.length} parsed, ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
