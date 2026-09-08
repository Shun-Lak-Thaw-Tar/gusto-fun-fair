import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventConfig",
      required: true,
      index: true,
    },
    privilege: {
      type: String,
      enum: ["MEMORY_UPLOAD", "QUIZ"],
      required: true,
    },
    consumedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

schema.index({ userId: 1, orderId: 1, privilege: 1 }, { unique: true });
export default mongoose.model("PreorderPrivilegeUse", schema);
