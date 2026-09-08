import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 500 },
    options: {
      type: [String],
      required: true,
      validate: (value) => value.length === 4,
    },
    correctOption: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
      validate: Number.isInteger,
    },
    version: { type: Number, default: 1, min: 1, validate: Number.isInteger },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export default mongoose.model("QuizQuestion", schema);
