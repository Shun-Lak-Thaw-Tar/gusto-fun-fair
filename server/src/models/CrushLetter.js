import mongoose from 'mongoose';

export const CRUSH_LETTER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'];

const crushLetterSchema = new mongoose.Schema(
  {
    recipientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    isAnonymous: {
      type: Boolean,
      default: true,
      immutable: true,
    },
    status: { type: String, enum: CRUSH_LETTER_STATUSES, default: 'PENDING', index: true },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('CrushLetter', crushLetterSchema);
