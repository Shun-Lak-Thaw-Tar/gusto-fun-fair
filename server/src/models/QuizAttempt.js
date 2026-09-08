import mongoose from "mongoose";

const questionSnapshotSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuizQuestion",
      required: true,
    },
    version: { type: Number, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctOption: { type: Number, required: true },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    questions: {
      type: [questionSnapshotSchema],
      required: true,
      validate: (value) => value.length === 5,
    },
    answers: { type: [Number], default: undefined },
    score: { type: Number, min: 0, max: 5 },
    passed: Boolean,
    timedOut: Boolean,
    elapsedMs: { type: Number, min: 0 },
    reward: { type: { type: String, enum: ["NOT_ISSUED"] }, message: String },
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
  },
  { timestamps: true },
);

schema.index({ userId: 1, orderId: 1 }, { unique: true });
schema.index({ passed: 1, elapsedMs: 1 });
export default mongoose.model("QuizAttempt", schema);
