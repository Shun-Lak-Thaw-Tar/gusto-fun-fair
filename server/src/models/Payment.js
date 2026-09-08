import mongoose from 'mongoose';
import { mediaSchemaDefinition } from './shared.js';

const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  paymentMethod: { type: String, enum: ['KBZ'], default: 'KBZ' },
  paymentProof: mediaSchemaDefinition,
  status: { type: String, enum: ['SUBMITTED', 'REUPLOAD_REQUESTED', 'APPROVED', 'REJECTED'], default: 'SUBMITTED' },
  proofVersion: { type: Number, default: 0 },
  proofs: [{ assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset', required: true }, version: Number, submittedAt: Date }],
  reviewHistory: [{ decision: String, reason: String, proofVersion: Number, reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date }],
  reuploadReason: { type: String, maxlength: 500 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date,
  rejectionReason: { type: String, trim: true, maxlength: 500 }, submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });
export default mongoose.model('Payment', paymentSchema);
