import mongoose from 'mongoose';
import { mediaSchemaDefinition } from './shared.js';

const foodItemSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  eventDayPrice: { type: Number, required: true, min: 0 },
  image: mediaSchemaDefinition,
  ticketLimit: { type: Number, required: true, min: 0, validate: Number.isInteger },
  reservedTickets: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  soldTickets: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

foodItemSchema.index({ stallId: 1, name: 1 }, { unique: true });
foodItemSchema.virtual('ticketsRemaining').get(function getTicketsRemaining() {
  return Math.max(0, this.ticketLimit - (this.reservedTickets || 0) - (this.soldTickets || 0));
});
foodItemSchema.set('toJSON', { virtuals: true });
export default mongoose.model('FoodItem', foodItemSchema);
