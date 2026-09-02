import mongoose from 'mongoose';
import { mediaSchemaDefinition } from './shared.js';

const foodItemSchema = new mongoose.Schema({
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  eventDayPrice: { type: Number, required: true, min: 0 },
  image: mediaSchemaDefinition,
  ticketLimit: { type: Number, required: true, min: 0, validate: Number.isInteger },
  isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

foodItemSchema.index({ stallId: 1, name: 1 }, { unique: true });
export default mongoose.model('FoodItem', foodItemSchema);
