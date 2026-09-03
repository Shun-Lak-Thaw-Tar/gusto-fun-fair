import mongoose from 'mongoose';

const featureFlagsSchema = new mongoose.Schema({
  memoriesEnabled: { type: Boolean, default: false },
  eventPageEnabled: { type: Boolean, default: false },
}, { _id: false, strict: 'throw' });

const eventConfigSchema = new mongoose.Schema({
  configKey: { type: String, enum: ['current'], default: 'current', unique: true, immutable: true },
  eventName: { type: String, required: true, trim: true }, eventDate: { type: Date, required: true },
  eventTimezone: { type: String, enum: ['Asia/Yangon'], default: 'Asia/Yangon', required: true },
  preorderOpenAt: { type: Date, required: true }, preorderCloseAt: { type: Date, required: true },
  kbzAccountName: { type: String, trim: true, default: '' }, kbzAccountNumber: { type: String, trim: true, default: '' },
  paymentInstructions: { type: String, trim: true, default: '' }, orderingEnabled: { type: Boolean, default: false },
  featureFlags: { type: featureFlagsSchema, default: () => ({}) },
  orderReservationMinutes: { type: Number, min: 1, validate: Number.isInteger, default: 60 },
  paymentProofGraceMinutes: { type: Number, min: 1, validate: Number.isInteger, default: 30 },
}, { timestamps: true });

eventConfigSchema.pre('validate', function validateCloseDate(next) {
  if (this.preorderOpenAt && this.preorderCloseAt && this.preorderOpenAt >= this.preorderCloseAt) return next(new Error('Preorder opening must be before closing'));
  if (this.eventDate && this.preorderCloseAt && this.preorderCloseAt >= this.eventDate) return next(new Error('Preorders must close before the event'));
  return next();
});
export default mongoose.model('EventConfig', eventConfigSchema);
