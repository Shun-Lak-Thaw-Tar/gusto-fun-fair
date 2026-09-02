import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  code: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['ACTIVE', 'REDEEMED', 'CANCELLED'], default: 'ACTIVE' },
  generatedAt: { type: Date, default: Date.now }, redeemedAt: Date,
  redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
export default mongoose.model('Ticket', ticketSchema);
