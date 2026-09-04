import { z } from 'zod';
import CrushLetter from '../models/CrushLetter.js';
import EventConfig from '../models/EventConfig.js';
import ApiError from '../utils/ApiError.js';

const crushLetterSchema = z.object({
  recipientName: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(1000),
}).strict();
const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict();

const presentPublicLetter = (letter) => ({ id: String(letter._id), recipientName: letter.recipientName, message: letter.message, createdAt: letter.createdAt });

export const createCrushLetter = async (req, res) => {
  const event = await EventConfig.findOne({ configKey: 'current' });
  if (!event?.featureFlags?.crushLettersEnabled) throw new ApiError(409, 'Crush Letter submissions are currently closed.');
  const parsed = crushLetterSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(
      400,
      'Invalid crush letter data',
      z.treeifyError(parsed.error)
    );
  }

  const crushLetter = await CrushLetter.create({
    recipientName: parsed.data.recipientName,
    message: parsed.data.message,
    isAnonymous: true,
  });

  res.status(201).json({
    message: 'Crush letter submitted for review.',
    crushLetter: { id: String(crushLetter._id), recipientName: crushLetter.recipientName, createdAt: crushLetter.createdAt, status: crushLetter.status },
  });
};

export const listCrushLetters = async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'Invalid pagination', z.treeifyError(parsed.error));
  const { page, limit } = parsed.data;
  const filter = { status: 'APPROVED' };
  const [letters, total] = await Promise.all([
    CrushLetter.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    CrushLetter.countDocuments(filter),
  ]);

  res.json({
    crushLetters: letters.map(presentPublicLetter),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};
