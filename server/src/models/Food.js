import mongoose from 'mongoose';
import { mediaSchemaDefinition } from './shared.js';

const foodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  category: { type: String, trim: true, maxlength: 100, default: '' },
  image: mediaSchemaDefinition,
  isActive: { type: Boolean, default: true },
  seedKey: { type: String, unique: true, sparse: true },
  legacyFoodItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem', unique: true, sparse: true, immutable: true },
}, { timestamps: true });

export default mongoose.model('Food', foodSchema);
