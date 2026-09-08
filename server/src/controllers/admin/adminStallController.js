import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import MediaAsset from '../../models/MediaAsset.js';
import StallFood from '../../models/StallFood.js';
import Stall from '../../models/Stall.js';
import User from '../../models/User.js';
import ApiError from '../../utils/ApiError.js';
import { attachImage, discardUpload, uploadImage } from '../../services/mediaService.js';
import { createStall as createStallRecord } from '../../services/stallService.js';
import { getStallSales } from '../../services/stallSalesService.js';

const zBool = z.preprocess((value) => (value === 'true' ? true : value === 'false' ? false : value), z.boolean());
const createSchema = z.object({ stallName: z.string().trim().min(1).max(100), batch: z.string().trim().min(1).max(50), description: z.string().trim().max(500).optional(), isActive: zBool.optional(), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional() }).strict();
const updateSchema = createSchema.omit({ slug: true }).partial();
const ownerCredentialsSchema = z.object({ name: z.string().trim().min(2).max(50), password: z.string().min(8).max(128) }).strict();
const passwordSchema = z.object({ password: z.string().min(8).max(128) }).strict();
const statusSchema = z.object({ isActive: z.boolean() }).strict();
const parse = (schema, body, message) => { const result = schema.safeParse(body); if (!result.success) throw new ApiError(400, message, z.treeifyError(result.error)); return result.data; };
const ownerView = (owner) => owner ? { _id: owner._id, name: owner.name, role: owner.role, stallId: owner.stallId, isActive: owner.isActive, createdAt: owner.createdAt, updatedAt: owner.updatedAt } : null;

export const listStalls = async (_req, res) => res.json({ stalls: await Stall.find().sort({ stallName: 1 }).lean() });
export const getStall = async (req, res) => {
  const stall = await Stall.findById(req.params.id);
  if (!stall) throw new ApiError(404, 'Stall not found');
  const [foods, sales, owner] = await Promise.all([StallFood.find({ stallId: stall._id }).populate('foodId', 'name description category image isActive').lean(), getStallSales(stall._id), User.findOne({ role: 'stall_owner', stallId: stall._id })]);
  res.json({ stall, foods, sales, owner: ownerView(owner) });
};
export const createStall = async (req, res) => {
  const data = parse(createSchema, req.body, 'Invalid stall data');
  if (!req.file) return res.status(201).json({ stall: await createStallRecord(data) });
  const asset = await uploadImage({ file: req.file, userId: req.user._id, purpose: 'stalls' });
  try {
    const stallId = new mongoose.Types.ObjectId();
    const stall = await createStallRecord({ ...data, _id: stallId, image: { assetId: asset._id, storageKey: asset.storageKey, provider: 'r2', url: `/api/stalls/${stallId}/image` } });
    await attachImage(asset);
    res.status(201).json({ stall });
  } catch (error) {
    await discardUpload(asset);
    throw error;
  }
};
export const updateStall = async (req, res) => {
  const data = parse(updateSchema, req.body, 'Invalid stall data');
  if (!req.file) {
    if (!Object.keys(data).length) throw new ApiError(400, 'At least one field is required');
    const stall = await Stall.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!stall) throw new ApiError(404, 'Stall not found');
    return res.json({ stall });
  }
  const existing = await Stall.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Stall not found');
  const asset = await uploadImage({ file: req.file, userId: req.user._id, purpose: 'stalls' });
  try {
    const previousAssetId = existing.image?.assetId;
    Object.assign(existing, data);
    existing.image = { assetId: asset._id, storageKey: asset.storageKey, provider: 'r2', url: `/api/stalls/${existing._id}/image` };
    await existing.save();
    await attachImage(asset);
    if (previousAssetId) await MediaAsset.updateOne({ _id: previousAssetId, status: 'ATTACHED' }, { status: 'DELETE_PENDING' });
    res.json({ stall: existing });
  } catch (error) {
    await discardUpload(asset);
    throw error;
  }
};
export const updateStallStatus = async (req, res) => {
  const { isActive } = parse(statusSchema, req.body, 'Invalid stall status');
  const stall = await Stall.findByIdAndUpdate(req.params.id, { isActive }, { new: true, runValidators: true });
  if (!stall) throw new ApiError(404, 'Stall not found');
  res.json({ stall });
};
export const getStallOwner = async (req, res) => {
  if (!await Stall.exists({ _id: req.params.stallId })) throw new ApiError(404, 'Stall not found');
  res.json({ owner: ownerView(await User.findOne({ role: 'stall_owner', stallId: req.params.stallId })) });
};
export const createStallOwner = async (req, res) => {
  const data = parse(ownerCredentialsSchema, req.body, 'Invalid owner account data');
  if (!await Stall.exists({ _id: req.params.stallId })) throw new ApiError(404, 'Stall not found');
  if (await User.exists({ role: 'stall_owner', stallId: req.params.stallId })) throw new ApiError(409, 'This stall already has an owner account');
  const name = data.name.trim().replace(/\s+/g, ' ');
  const owner = await User.create({ name, nameNormalized: name.toLocaleLowerCase('en-US'), passwordHash: await bcrypt.hash(data.password, 12), role: 'stall_owner', stallId: req.params.stallId });
  res.status(201).json({ owner: ownerView(owner) });
};
export const resetStallOwnerPassword = async (req, res) => {
  const { password } = parse(passwordSchema, req.body, 'Invalid password');
  const owner = await User.findOne({ role: 'stall_owner', stallId: req.params.stallId }).select('+passwordHash');
  if (!owner) throw new ApiError(404, 'Stall owner account not found');
  owner.passwordHash = await bcrypt.hash(password, 12); await owner.save();
  res.json({ owner: ownerView(owner) });
};
export const updateStallOwnerStatus = async (req, res) => {
  const { isActive } = parse(statusSchema, req.body, 'Invalid owner status');
  const owner = await User.findOneAndUpdate({ role: 'stall_owner', stallId: req.params.stallId }, { isActive }, { new: true, runValidators: true });
  if (!owner) throw new ApiError(404, 'Stall owner account not found');
  res.json({ owner: ownerView(owner) });
};
