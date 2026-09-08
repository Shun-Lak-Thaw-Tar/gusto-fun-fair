import mongoose from 'mongoose';

const memorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventConfig', required: true, index: true },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset', required: true },
  // Owner deletion frees a slot; admin removal keeps it occupied for this event.
  slot: { type: Number, enum: [1, 2] },
  status: { type: String, enum: ['ACTIVE', 'OWNER_DELETED', 'ADMIN_REMOVED'], default: 'ACTIVE' },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: Date,
  reactionVersion: { type: Number, default: 0 },
  caption: { type: String, trim: true, maxlength: 300, default: '' },
}, { timestamps: true });
memorySchema.index({ eventId: 1, userId: 1, slot: 1 }, { unique: true, partialFilterExpression: { slot: { $type: 'number' } } });
memorySchema.index({ eventId: 1, status: 1, _id: -1 });
export default mongoose.model('Memory', memorySchema);
