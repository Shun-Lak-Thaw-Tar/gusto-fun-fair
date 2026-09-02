import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 50 },
  nameNormalized: { type: String, required: true, unique: true, select: false },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });

userSchema.set('toJSON', { transform: (_doc, value) => { delete value.passwordHash; delete value.nameNormalized; return value; } });
export default mongoose.model('User', userSchema);
