import mongoose from 'mongoose';
import { z } from 'zod';
import Memory from '../models/Memory.js';
import MemoryReaction from '../models/MemoryReaction.js';
import SnapSettings from '../models/SnapSettings.js';
import ApiError from '../utils/ApiError.js';
import { getCurrentEvent } from '../services/eventService.js';
import { assertSnapWindow, createSnap, currentSnapContext, deleteSnap, setReaction } from '../services/memoryService.js';
import { discardUpload, sendImage, uploadImage } from '../services/mediaService.js';

const captionSchema = z.object({ caption: z.string().trim().max(300).optional().default('') }).strict();
const paginationSchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), before: z.string().regex(/^[a-f0-9]{24}$/i).optional() });
const settingsSchema = z.object({ opensAt: z.iso.datetime({ offset: true }), closesAt: z.iso.datetime({ offset: true }) }).strict().refine(value => new Date(value.opensAt) < new Date(value.closesAt), { message: 'Opening must be before closing' });

export const createMemory = async (req, res) => {
  const parsed = captionSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Caption must be at most 300 characters');
  const event = await getCurrentEvent();
  await assertSnapWindow(event._id);
  const asset = await uploadImage({ file: req.file, userId: req.user._id, purpose: 'snaps' });
  try {
    const memory = await createSnap({ userId: req.user._id, eventId: event._id, asset, caption: parsed.data.caption });
    res.status(201).json({ memory: { id: memory._id, accountName: req.user.name, caption: memory.caption, imageUrl: `/api/memories/${memory._id}/image`, createdAt: memory.createdAt } });
  } catch (error) {
    await discardUpload(asset);
    throw error;
  }
};

export const listMemories = async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'Invalid pagination parameters');
  const event = await getCurrentEvent();
  const { limit, before } = parsed.data;
  const rows = await Memory.find({ eventId: event._id, status: 'ACTIVE', ...(before ? { _id: { $lt: new mongoose.Types.ObjectId(before) } } : {}) }).sort({ _id: -1 }).limit(limit + 1).populate('userId', 'name').lean();
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const counts = await MemoryReaction.aggregate([{ $match: { memoryId: { $in: page.map(row => row._id) } } }, { $group: { _id: { memoryId: '$memoryId', reaction: '$reaction' }, count: { $sum: 1 } } }]);
  const totals = new Map();
  for (const row of counts) {
    const key = String(row._id.memoryId);
    const item = totals.get(key) || { likes: 0, dislikes: 0 };
    item[row._id.reaction === 'LIKE' ? 'likes' : 'dislikes'] = row.count;
    totals.set(key, item);
  }
  res.json({ memories: page.map(row => ({ id: row._id, accountName: row.userId?.name || 'Deleted account', caption: row.caption, imageUrl: `/api/memories/${row._id}/image`, createdAt: row.createdAt, ...(totals.get(String(row._id)) || { likes: 0, dislikes: 0 }) })), nextCursor: hasMore ? String(page.at(-1)._id) : null });
};

export const getMemoryImage = async (req, res) => {
  const memory = await Memory.findOne({ _id: req.params.id, status: 'ACTIVE' });
  if (!memory) throw new ApiError(404, 'Photo not found');
  await sendImage(memory.assetId, res, { publicGallery: true });
};
export const deleteMyMemory = async (req, res) => { await deleteSnap({ id: req.params.id, user: req.user }); res.status(204).end(); };
export const removeMemory = async (req, res) => { await deleteSnap({ id: req.params.id, user: req.user, admin: true }); res.status(204).end(); };
export const getSnapWindow = async (_req, res) => res.json({ snaps: await currentSnapContext() });
export const getMySnapAllowance = async (req, res) => res.json({ snaps: await currentSnapContext(req.user._id) });
export const getMyMemories = async (req, res) => {
  const event = await getCurrentEvent();
  const memories = await Memory.find({ eventId: event._id, userId: req.user._id, status: { $in: ['ACTIVE', 'ADMIN_REMOVED'] } }).select('_id caption status createdAt').lean();
  res.json({ memories: memories.map(row => ({ ...row, imageUrl: row.status === 'ACTIVE' ? `/api/memories/${row._id}/image` : null })) });
};
export const updateSnapWindow = async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Provide an opening and later closing timestamp, each including Z or a timezone offset');
  const event = await getCurrentEvent();
  await SnapSettings.findOneAndUpdate({ eventId: event._id }, { ...parsed.data, updatedBy: req.user._id }, { upsert: true, new: true, runValidators: true });
  res.json({ snaps: await currentSnapContext() });
};
export const reactToMemory = async (req, res) => {
  const parsed = z.object({ reaction: z.enum(['LIKE', 'DISLIKE']).nullable() }).strict().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Reaction must be LIKE, DISLIKE, or null');
  res.json({ reaction: await setReaction({ memoryId: req.params.id, userId: req.user._id, reaction: parsed.data.reaction }) });
};
export const getMyReaction = async (req, res) => {
  if (!await Memory.exists({ _id: req.params.id, status: 'ACTIVE' })) throw new ApiError(404, 'Photo not found');
  const item = await MemoryReaction.findOne({ memoryId: req.params.id, userId: req.user._id });
  res.json({ reaction: item?.reaction || null });
};
