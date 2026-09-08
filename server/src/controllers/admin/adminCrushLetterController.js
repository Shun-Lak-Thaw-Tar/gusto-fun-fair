import mongoose from 'mongoose';
import { z } from 'zod';
import CrushLetter, { CRUSH_LETTER_STATUSES } from '../../models/CrushLetter.js';
import ApiError from '../../utils/ApiError.js';

const listSchema = z.object({
  status: z.enum(CRUSH_LETTER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
const reviewSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) }).strict();
const visibilitySchema = z.object({ hidden: z.boolean() }).strict();

const assertId = (id) => {
  if (!mongoose.isObjectIdOrHexString(id)) throw new ApiError(400, 'Invalid Crush Letter ID');
};

const pendingFilter = { $or: [{ status: 'PENDING' }, { status: { $exists: false } }, { status: null }] };
const presentAdminLetter = (letter) => ({
  id: String(letter._id),
  recipientName: letter.recipientName,
  message: letter.message,
  isAnonymous: letter.isAnonymous !== false,
  status: letter.status || 'PENDING',
  createdAt: letter.createdAt,
  updatedAt: letter.updatedAt,
  reviewedAt: letter.reviewedAt || null,
  reviewedBy: letter.reviewedBy ? { id: String(letter.reviewedBy._id), name: letter.reviewedBy.name } : null,
});

export const listCrushLetters = async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'Invalid Crush Letter query', z.treeifyError(parsed.error));
  const { status, page, limit } = parsed.data;
  const filter = status === 'PENDING' ? pendingFilter : status ? { status } : {};
  const [letters, total] = await Promise.all([
    CrushLetter.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('reviewedBy', 'name').lean(),
    CrushLetter.countDocuments(filter),
  ]);
  res.json({ crushLetters: letters.map(presentAdminLetter), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getCrushLetter = async (req, res) => {
  assertId(req.params.id);
  const letter = await CrushLetter.findById(req.params.id).populate('reviewedBy', 'name').lean();
  if (!letter) throw new ApiError(404, 'Crush Letter not found');
  res.json({ crushLetter: presentAdminLetter(letter) });
};

export const reviewCrushLetter = async (req, res) => {
  assertId(req.params.id);
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid review decision', z.treeifyError(parsed.error));
  const letter = await CrushLetter.findOneAndUpdate(
    { _id: req.params.id, ...pendingFilter },
    { $set: { status: parsed.data.decision, reviewedAt: new Date(), reviewedBy: req.user._id } },
    { new: true },
  ).populate('reviewedBy', 'name');
  if (!letter) {
    if (!await CrushLetter.exists({ _id: req.params.id })) throw new ApiError(404, 'Crush Letter not found');
    throw new ApiError(409, 'Only pending Crush Letters can be reviewed');
  }
  res.json({ message: `Crush Letter ${parsed.data.decision.toLowerCase()}.`, crushLetter: presentAdminLetter(letter) });
};

export const updateCrushLetterVisibility = async (req, res) => {
  assertId(req.params.id);
  const parsed = visibilitySchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid visibility update', z.treeifyError(parsed.error));
  const from = parsed.data.hidden ? 'APPROVED' : 'HIDDEN';
  const to = parsed.data.hidden ? 'HIDDEN' : 'APPROVED';
  const letter = await CrushLetter.findOneAndUpdate(
    { _id: req.params.id, status: from },
    { $set: { status: to, reviewedAt: new Date(), reviewedBy: req.user._id } },
    { new: true },
  ).populate('reviewedBy', 'name');
  if (!letter) {
    if (!await CrushLetter.exists({ _id: req.params.id })) throw new ApiError(404, 'Crush Letter not found');
    throw new ApiError(409, parsed.data.hidden ? 'Only approved Crush Letters can be hidden' : 'Only hidden Crush Letters can be restored');
  }
  res.json({ message: parsed.data.hidden ? 'Crush Letter hidden.' : 'Crush Letter restored.', crushLetter: presentAdminLetter(letter) });
};
