import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: ['proofs', 'snaps'], required: true },
  storageKey: { type: String, required: true, unique: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  status: { type: String, enum: ['STAGED', 'ATTACHED', 'DELETE_PENDING'], default: 'STAGED', index: true },
}, { timestamps: true });
export default mongoose.model('MediaAsset', schema);
