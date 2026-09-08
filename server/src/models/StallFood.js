import mongoose from 'mongoose';

const discountSchema = new mongoose.Schema({
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true, min: 0, validate: { validator(value) { return this.type !== 'percentage' || value <= 100; }, message: 'Percentage discount cannot exceed 100' } },
}, { _id: false });

const stallFoodSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true, index: true },
  foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true, index: true },
  eventDayPrice: { type: Number, required: true, min: 0 },
  discount: { type: discountSchema, required: true, default: () => ({ type: 'percentage', value: 0 }) },
  ticketLimit: { type: Number, required: true, min: 0, validate: Number.isInteger },
  reservedTickets: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  soldTickets: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  isAvailable: { type: Boolean, default: true },
  legacyFoodItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem', unique: true, sparse: true, immutable: true },
}, { timestamps: true });

stallFoodSchema.index({ stallId: 1, foodId: 1 }, { unique: true });
stallFoodSchema.virtual('ticketsRemaining').get(function getTicketsRemaining() { return Math.max(0, this.ticketLimit - (this.reservedTickets || 0) - (this.soldTickets || 0)); });
stallFoodSchema.set('toJSON', { virtuals: true });
export default mongoose.model('StallFood', stallFoodSchema);
