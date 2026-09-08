import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 50 },
  nameNormalized: { type: String, required: true, unique: true, select: false },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin', 'stall_owner'], default: 'user' },
  stallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.index({ stallId: 1 }, { unique: true, partialFilterExpression: { role: 'stall_owner', stallId: { $type: 'objectId' } } });
userSchema.pre('validate', function validateOwnerStall(next) {
  if (this.role === 'stall_owner' && !this.stallId) return next(new Error('Stall owner accounts require a stall'));
  if (this.role !== 'stall_owner' && this.stallId) return next(new Error('Only stall owner accounts may have a stall'));
  return next();
});

userSchema.set('toJSON', { transform: (_doc, value) => { delete value.passwordHash; delete value.nameNormalized; return value; } });
export default mongoose.model('User', userSchema);
