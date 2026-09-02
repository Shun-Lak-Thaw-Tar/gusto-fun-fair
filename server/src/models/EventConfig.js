import mongoose from 'mongoose';

const eventConfigSchema = new mongoose.Schema({
  eventName: { type: String, required: true, trim: true }, eventDate: { type: Date, required: true },
  preorderOpenAt: Date, preorderCloseAt: { type: Date, required: true },
  kbzAccountName: { type: String, trim: true, default: '' }, kbzAccountNumber: { type: String, trim: true, default: '' },
  paymentInstructions: { type: String, trim: true, default: '' }, orderingEnabled: { type: Boolean, default: false },
}, { timestamps: true });

eventConfigSchema.pre('validate', function validateCloseDate(next) {
  if (this.eventDate && this.preorderCloseAt && this.preorderCloseAt > new Date(this.eventDate.getTime() - 24 * 60 * 60 * 1000)) return next(new Error('Preorders must close at least one day before the event'));
  return next();
});
export default mongoose.model('EventConfig', eventConfigSchema);
