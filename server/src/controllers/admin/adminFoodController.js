import { z } from 'zod';
import FoodItem from '../../models/FoodItem.js';
import Stall from '../../models/Stall.js';
import ApiError from '../../utils/ApiError.js';
import { calculatePreorderPrice } from '../../services/pricingService.js';
import { ticketsRemaining } from '../../services/inventoryService.js';

const mediaSchema = z.object({ url: z.string().trim().optional(), storageKey: z.string().trim().optional(), provider: z.string().trim().optional() }).strict();
const schema = z.object({ stallId: z.string().regex(/^[a-f\d]{24}$/i), name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional(), eventDayPrice: z.number().min(0), image: mediaSchema.optional(), ticketLimit: z.number().int().min(0), isAvailable: z.boolean().optional() }).strict();
const parse = (validator, body) => { const result = validator.safeParse(body); if (!result.success) throw new ApiError(400, 'Invalid food data', z.treeifyError(result.error)); return result.data; };
const present = (food) => ({ ...food, preorderPrice: food.stallId?.discount ? calculatePreorderPrice(food.eventDayPrice, food.stallId.discount) : null, ticketsRemaining: ticketsRemaining(food) });

export const listFoods = async (req, res) => {
  const foods = await FoodItem.find(req.query.stallId ? { stallId: req.query.stallId } : {}).populate('stallId', 'stallName discount isActive').sort({ name: 1 }).lean();
  res.json({ foods: foods.map(present) });
};
export const getFood = async (req, res) => { const food = await FoodItem.findById(req.params.id).populate('stallId', 'stallName discount isActive').lean(); if (!food) throw new ApiError(404, 'Food item not found'); res.json({ food: present(food) }); };
export const createFood = async (req, res) => {
  const data = parse(schema, req.body);
  if (!await Stall.exists({ _id: data.stallId })) throw new ApiError(400, 'Referenced stall does not exist');
  const food = await FoodItem.create(data);
  res.status(201).json({ food: present((await food.populate('stallId', 'stallName discount isActive')).toObject()) });
};
export const updateFood = async (req, res) => {
  const data = parse(schema.partial().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' }), req.body);
  if (data.stallId && !await Stall.exists({ _id: data.stallId })) throw new ApiError(400, 'Referenced stall does not exist');
  const filter = { _id: req.params.id };
  if (data.ticketLimit !== undefined) filter.$expr = { $lte: [{ $add: [{ $ifNull: ['$reservedTickets', 0] }, { $ifNull: ['$soldTickets', 0] }] }, data.ticketLimit] };
  const food = await FoodItem.findOneAndUpdate(filter, data, { new: true, runValidators: true }).populate('stallId', 'stallName discount isActive');
  if (!food) {
    if (await FoodItem.exists({ _id: req.params.id })) throw new ApiError(409, 'Ticket limit cannot be below reserved plus sold tickets');
    throw new ApiError(404, 'Food item not found');
  }
  res.json({ food: present(food.toObject()) });
};
