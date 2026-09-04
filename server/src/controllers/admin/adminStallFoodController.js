import { z } from 'zod';
import Food from '../../models/Food.js';
import Stall from '../../models/Stall.js';
import StallFood from '../../models/StallFood.js';
import ApiError from '../../utils/ApiError.js';
import { calculatePreorderPrice } from '../../services/pricingService.js';
import { ticketsRemaining } from '../../services/inventoryService.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const discountSchema = z.discriminatedUnion('type', [z.object({ type: z.literal('percentage'), value: z.number().min(0).max(100) }).strict(), z.object({ type: z.literal('fixed'), value: z.number().min(0) }).strict()]);
const schema = z.object({ stallId: objectId, foodId: objectId, eventDayPrice: z.number().min(0), discount: discountSchema, ticketLimit: z.number().int().min(0), isAvailable: z.boolean().optional() }).strict();
const querySchema = z.object({ stallId: objectId.optional(), foodId: objectId.optional() }).strict();
const parse = (validator, value) => { const result = validator.safeParse(value); if (!result.success) throw new ApiError(400, 'Invalid stall food data', z.treeifyError(result.error)); return result.data; };
export const presentAdminStallFood = (entry) => ({ ...entry, preorderPrice: calculatePreorderPrice(entry.eventDayPrice, entry.discount), ticketsRemaining: ticketsRemaining(entry) });
const populate = (query) => query.populate('stallId', 'stallName batch isActive').populate('foodId', 'name description category image isActive');

export const listStallFoods = async (req, res) => {
  const filter = parse(querySchema, req.query);
  const entries = await populate(StallFood.find(filter)).sort({ createdAt: 1 }).lean();
  res.json({ stallFoods: entries.map(presentAdminStallFood) });
};
export const getStallFood = async (req, res) => { const entry = await populate(StallFood.findById(req.params.id)).lean(); if (!entry) throw new ApiError(404, 'Stall food not found'); res.json({ stallFood: presentAdminStallFood(entry) }); };
export const createStallFood = async (req, res) => {
  const data = parse(schema, req.body);
  if (!await Stall.exists({ _id: data.stallId })) throw new ApiError(400, 'Referenced stall does not exist');
  if (!await Food.exists({ _id: data.foodId })) throw new ApiError(400, 'Referenced food does not exist');
  if (await StallFood.exists({ stallId: data.stallId, foodId: data.foodId })) throw new ApiError(409, 'This food is already assigned to the stall');
  const entry = await StallFood.create(data);
  res.status(201).json({ stallFood: presentAdminStallFood((await populate(StallFood.findById(entry._id)).lean())) });
};
export const updateStallFood = async (req, res) => {
  const data = parse(schema.partial().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' }), req.body);
  if (data.stallId && !await Stall.exists({ _id: data.stallId })) throw new ApiError(400, 'Referenced stall does not exist');
  if (data.foodId && !await Food.exists({ _id: data.foodId })) throw new ApiError(400, 'Referenced food does not exist');
  const filter = { _id: req.params.id };
  if (data.ticketLimit !== undefined) filter.$expr = { $lte: [{ $add: [{ $ifNull: ['$reservedTickets', 0] }, { $ifNull: ['$soldTickets', 0] }] }, data.ticketLimit] };
  const entry = await populate(StallFood.findOneAndUpdate(filter, data, { new: true, runValidators: true })).lean();
  if (!entry) {
    if (await StallFood.exists({ _id: req.params.id })) throw new ApiError(409, 'Ticket limit cannot be below reserved plus sold tickets');
    throw new ApiError(404, 'Stall food not found');
  }
  res.json({ stallFood: presentAdminStallFood(entry) });
};
