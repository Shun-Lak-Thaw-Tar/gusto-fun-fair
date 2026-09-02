import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, trim: true }, title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true }, isRead: { type: Boolean, default: false },
}, { timestamps: true });
export default mongoose.model('Notification', notificationSchema);
