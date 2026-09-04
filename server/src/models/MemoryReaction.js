import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  memoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reaction: { type: String, enum: ['LIKE', 'DISLIKE'], required: true },
}, { timestamps: true });
schema.index({ memoryId: 1, userId: 1 }, { unique: true });
export default mongoose.model('MemoryReaction', schema);
