import mongoose from 'mongoose';
import { mediaSchemaDefinition } from './shared.js';

const stallSchema = new mongoose.Schema({
  stallName: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, trim: true, lowercase: true, unique: true, sparse: true, immutable: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  batch: { type: String, required: true, trim: true, maxlength: 50 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  discount: {
    type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    value: { type: Number, default: 0, min: 0, validate: { validator(value) { return this.type !== 'percentage' || value <= 100; }, message: 'Percentage discount cannot exceed 100' } },
  },
  image: mediaSchemaDefinition,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Stall', stallSchema);
