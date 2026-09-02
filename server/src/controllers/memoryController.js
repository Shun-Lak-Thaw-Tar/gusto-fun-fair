import { z } from 'zod';
import Memory from '../models/Memory.js';
import Ticket from '../models/Ticket.js';
import ApiError from '../utils/ApiError.js';

const schema = z.object({ image: z.object({ url: z.string().trim().min(1), storageKey: z.string().trim().optional().default(''), provider: z.string().trim().optional().default('') }), caption: z.string().trim().max(300).optional().default('') });
export const createMemory = async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid memory data', z.treeifyError(parsed.error));
  const ticket = await Ticket.findOne({ userId: req.user._id, status: { $in: ['ACTIVE', 'REDEEMED'] } });
  if (!ticket) throw new ApiError(403, 'An approved ticket purchase is required');
  if (await Memory.countDocuments({ userId: req.user._id }) >= 2) throw new ApiError(409, 'A maximum of two event memories is allowed');
  res.status(201).json({ memory: await Memory.create({ userId: req.user._id, ticketId: ticket._id, ...parsed.data }) });
};
export const listMemories = async (_req, res) => res.json({ memories: await Memory.find().sort({ createdAt: -1 }) });
