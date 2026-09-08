import mongoose from 'mongoose';
import { z } from 'zod';
import Food from '../../models/Food.js';
import MediaAsset from '../../models/MediaAsset.js';
import ApiError from '../../utils/ApiError.js';
import { attachImage, discardUpload, uploadImage } from '../../services/mediaService.js';

const zBool = z.preprocess((value) => (value === 'true' ? true : value === 'false' ? false : value), z.boolean());
const schema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional(), category: z.string().trim().max(100).optional(), isActive: zBool.optional() }).strict();
const parse = (validator, body) => { const result = validator.safeParse(body); if (!result.success) throw new ApiError(400, 'Invalid food data', z.treeifyError(result.error)); return result.data; };

export const listFoods = async (_req, res) => res.json({ foods: await Food.find().sort({ name: 1 }).lean() });
export const getFood = async (req, res) => { const food = await Food.findById(req.params.id).lean(); if (!food) throw new ApiError(404, 'Food not found'); res.json({ food }); };
export const createFood = async (req, res) => {
  const data = parse(schema, req.body);
  if (!req.file) return res.status(201).json({ food: await Food.create(data) });
  const asset = await uploadImage({ file: req.file, userId: req.user._id, purpose: 'foods' });
  try {
    const foodId = new mongoose.Types.ObjectId();
    const food = await Food.create({ ...data, _id: foodId, image: { assetId: asset._id, storageKey: asset.storageKey, provider: 'r2', url: `/api/foods/${foodId}/image` } });
    await attachImage(asset);
    res.status(201).json({ food });
  } catch (error) {
    await discardUpload(asset);
    throw error;
  }
};
export const updateFood = async (req, res) => {
  const data = parse(schema.partial(), req.body);
  if (!req.file) {
    if (!Object.keys(data).length) throw new ApiError(400, 'At least one field is required');
    const food = await Food.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!food) throw new ApiError(404, 'Food not found');
    return res.json({ food });
  }
  const existing = await Food.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Food not found');
  const asset = await uploadImage({ file: req.file, userId: req.user._id, purpose: 'foods' });
  try {
    const previousAssetId = existing.image?.assetId;
    Object.assign(existing, data);
    existing.image = { assetId: asset._id, storageKey: asset.storageKey, provider: 'r2', url: `/api/foods/${existing._id}/image` };
    await existing.save();
    await attachImage(asset);
    if (previousAssetId) await MediaAsset.updateOne({ _id: previousAssetId, status: 'ATTACHED' }, { status: 'DELETE_PENDING' });
    res.json({ food: existing });
  } catch (error) {
    await discardUpload(asset);
    throw error;
  }
};
