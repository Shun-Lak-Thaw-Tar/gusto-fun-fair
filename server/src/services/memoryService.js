import mongoose from 'mongoose';
import Memory from '../models/Memory.js';
import MemoryReaction from '../models/MemoryReaction.js';
import MediaAsset from '../models/MediaAsset.js';
import Order from '../models/Order.js';
import SnapSettings from '../models/SnapSettings.js';
import ApiError from '../utils/ApiError.js';
import { getCurrentEvent } from './eventService.js';
import { attachImage } from './mediaService.js';

export const windowStatus = (settings, now = new Date()) => {
  if (!settings) return 'NOT_CONFIGURED';
  if (now < settings.opensAt) return 'UPCOMING';
  return now < settings.closesAt ? 'OPEN' : 'CLOSED';
};

export const assertSnapWindow = async (eventId, session) => {
  const settings = await SnapSettings.findOne({ eventId }).session(session || null);
  if (windowStatus(settings) !== 'OPEN') throw new ApiError(409, 'Snap uploads are outside the configured window');
  return settings;
};

export const snapAllowance = async (userId, eventId, session) => {
  const approved = await Order.exists({ userId, eventId, status: 'PAYMENT_APPROVED' }).session(session || null);
  return approved ? 2 : 1;
};

export const createSnap = async ({ userId, eventId, asset, caption }) => {
  const limit = await snapAllowance(userId, eventId);
  // The unique event/user/slot index arbitrates concurrent uploads.
  for (let slot = 1; slot <= limit; slot += 1) {
    try {
      return await mongoose.connection.transaction(async (session) => {
        await assertSnapWindow(eventId, session);
        if (slot > await snapAllowance(userId, eventId, session)) throw new ApiError(409, 'Snap allowance changed');
        const [memory] = await Memory.create([{ userId, eventId, assetId: asset._id, caption, slot }], { session });
        await attachImage(asset, session);
        return memory;
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  throw new ApiError(409, 'Your photo allowance for this event is used');
};

export const deleteSnap = async ({ id, user, admin = false }) => mongoose.connection.transaction(async (session) => {
  const filter = { _id: id, status: 'ACTIVE', ...(!admin ? { userId: user._id } : {}) };
  const memory = await Memory.findOne(filter).session(session);
  if (!memory) throw new ApiError(404, 'Photo not found');
  if (!admin) await assertSnapWindow(memory.eventId, session);
  const update = { $set: { status: admin ? 'ADMIN_REMOVED' : 'OWNER_DELETED', deletedBy: user._id, deletedAt: new Date() }, ...(!admin ? { $unset: { slot: 1 } } : {}) };
  const deleted = await Memory.findOneAndUpdate(filter, update, { new: true, session });
  if (!deleted) throw new ApiError(409, 'Photo already changed');
  await MemoryReaction.deleteMany({ memoryId: memory._id }, { session });
  await MediaAsset.updateOne({ _id: memory.assetId }, { status: 'DELETE_PENDING' }, { session });
  return deleted;
});

export const setReaction = async ({ memoryId, userId, reaction }) => mongoose.connection.transaction(async (session) => {
  // Serialize with removal so reactions cannot be inserted after a photo is removed.
  const memory = await Memory.findOneAndUpdate({ _id: memoryId, status: 'ACTIVE' }, { $inc: { reactionVersion: 1 } }, { session, new: true });
  if (!memory) throw new ApiError(404, 'Photo not found');
  if (reaction === null) await MemoryReaction.deleteOne({ memoryId, userId }, { session });
  else await MemoryReaction.findOneAndUpdate({ memoryId, userId }, { $set: { reaction } }, { upsert: true, new: true, runValidators: true, session });
  return reaction;
});

export const currentSnapContext = async (userId) => {
  const event = await getCurrentEvent();
  const settings = await SnapSettings.findOne({ eventId: event._id });
  const result = { eventId: event._id, timeZone: 'Asia/Yangon', opensAt: settings?.opensAt || null, closesAt: settings?.closesAt || null, status: windowStatus(settings) };
  if (userId) {
    result.allowance = await snapAllowance(userId, event._id);
    result.used = await Memory.countDocuments({ eventId: event._id, userId, slot: { $in: [1, 2] } });
    result.remaining = Math.max(0, result.allowance - result.used);
  }
  return result;
};
