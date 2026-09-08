import mongoose from 'mongoose';

export const ORDER_STATUSES = ['AWAITING_PAYMENT', 'PAYMENT_DECLARED', 'PAYMENT_SUBMITTED', 'PAYMENT_REUPLOAD_REQUESTED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED', 'PAYMENT_EVIDENCE_EXPIRED', 'CANCELLED', 'EXPIRED'];
export const INVENTORY_STATUSES = ['RESERVED', 'SOLD', 'RELEASED'];
const orderItemSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
  stallFoodId: { type: mongoose.Schema.Types.ObjectId, ref: 'StallFood' },
  foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
  foodItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem' },
  stallName: { type: String, required: true }, foodName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  unitPrice: { type: Number, required: true, min: 0 }, subtotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventConfig', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [orderItemSchema], required: true, validate: [(items) => items.length > 0, 'Order requires at least one item'] },
  totalQuantity: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ORDER_STATUSES, default: 'AWAITING_PAYMENT', index: true },
  inventoryStatus: { type: String, enum: INVENTORY_STATUSES, default: 'RESERVED', index: true },
  paymentReference: { type: String, required: true, unique: true, index: true },
  reservationExpiresAt: { type: Date, required: true, index: true },
  paymentDeclaredAt: Date,
  paymentProofExpiresAt: { type: Date, index: true },
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
