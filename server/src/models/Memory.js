import mongoose from 'mongoose';
import { mediaSchemaDefinition } from './shared.js';

const memorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  image: { type: new mongoose.Schema(mediaSchemaDefinition, { _id: false }), required: true },
  caption: { type: String, trim: true, maxlength: 300, default: '' },
}, { timestamps: true });
export default mongoose.model('Memory', memorySchema);
