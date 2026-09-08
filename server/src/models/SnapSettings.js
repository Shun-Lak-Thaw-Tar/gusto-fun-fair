import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventConfig', required: true, unique: true },
  opensAt: { type: Date, required: true },
  closesAt: { type: Date, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.pre('validate', function(next) {
  next(this.opensAt >= this.closesAt ? new Error('Snap opening must be before closing') : undefined);
});
export default mongoose.model('SnapSettings', schema);
