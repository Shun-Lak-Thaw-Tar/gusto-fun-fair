import { z } from 'zod';
import CrushLetter from '../models/CrushLetter.js';
import ApiError from '../utils/ApiError.js';

const crushLetterSchema = z.object({
  recipientName: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(1000),
});

export const createCrushLetter = async (req, res) => {
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
    message: 'Crush letter posted successfully',
    crushLetter,
  });
};

export const listCrushLetters = async (_req, res) => {
  const crushLetters = await CrushLetter
    .find()
    .sort({ createdAt: -1 });

  res.json({
    crushLetters,
  });
};