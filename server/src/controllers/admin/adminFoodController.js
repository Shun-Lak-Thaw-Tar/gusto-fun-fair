import { z } from 'zod';
import Food from '../../models/Food.js';
import ApiError from '../../utils/ApiError.js';

const mediaSchema = z.object({ url: z.string().trim().optional(), storageKey: z.string().trim().optional(), provider: z.string().trim().optional() }).strict();
const schema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional(), category: z.string().trim().max(100).optional(), image: mediaSchema.optional(), isActive: z.boolean().optional() }).strict();
const parse = (validator, body) => { const result = validator.safeParse(body); if (!result.success) throw new ApiError(400, 'Invalid food data', z.treeifyError(result.error)); return result.data; };

export const listFoods = async (_req, res) => res.json({ foods: await Food.find().sort({ name: 1 }).lean() });
export const getFood = async (req, res) => { const food = await Food.findById(req.params.id).lean(); if (!food) throw new ApiError(404, 'Food not found'); res.json({ food }); };
export const createFood = async (req, res) => res.status(201).json({ food: await Food.create(parse(schema, req.body)) });
export const updateFood = async (req, res) => {
  const data = parse(schema.partial().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' }), req.body);
  const food = await Food.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!food) throw new ApiError(404, 'Food not found');
  res.json({ food });
};
