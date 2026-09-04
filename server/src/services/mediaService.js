import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import env from '../config/env.js';
import MediaAsset from '../models/MediaAsset.js';
import ApiError from '../utils/ApiError.js';
import { MAX_IMAGE_BYTES } from '../middleware/uploadMiddleware.js';

let client;
const r2 = () => {
  if (!env.r2AccountId || !env.r2AccessKeyId || !env.r2SecretAccessKey || !env.r2Bucket) throw new ApiError(503, 'R2 media storage is not configured');
  client ||= new S3Client({ region: 'auto', endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.r2AccessKeyId, secretAccessKey: env.r2SecretAccessKey }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  return client;
};

// Integration tests replace this adapter; HTTP validation and persistence still run.
export const mediaStorage = {
  put: (asset, body) => r2().send(new PutObjectCommand({ Bucket: env.r2Bucket, Key: asset.storageKey, Body: body, ContentType: asset.contentType, CacheControl: 'no-store' })),
  get: (asset) => r2().send(new GetObjectCommand({ Bucket: env.r2Bucket, Key: asset.storageKey })),
  delete: (asset) => r2().send(new DeleteObjectCommand({ Bucket: env.r2Bucket, Key: asset.storageKey })),
};

export const validateImage = async (file) => {
  if (!file?.buffer?.length) throw new ApiError(400, 'An image file is required');
  if (file.buffer.length > MAX_IMAGE_BYTES) throw new ApiError(413, 'Image must be at most 7 MB');
  try {
    const image = sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    const types = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    if (!types[metadata.format] || file.mimetype !== types[metadata.format] || (metadata.pages || 1) !== 1) throw new Error('Unsupported image');
    // Decode to reject corrupt data and strip EXIF/GPS metadata before storage.
    const buffer = await image.rotate().toFormat(metadata.format).toBuffer();
    if (buffer.length > MAX_IMAGE_BYTES) throw new ApiError(413, 'Processed image exceeds 7 MB');
    return { buffer, contentType: types[metadata.format], extension: metadata.format };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'A valid, single-frame JPEG, PNG, or WebP image of at most 40 megapixels is required');
  }
};

export const uploadImage = async ({ file, userId, purpose }) => {
  if (!['proofs', 'snaps'].includes(purpose)) throw new Error('Invalid media purpose');
  const { buffer, contentType, extension } = await validateImage(file);
  const asset = await MediaAsset.create({ userId, purpose, storageKey: `${purpose}/${userId}/${randomUUID()}.${extension}`, contentType, size: buffer.length });
  try {
    await mediaStorage.put(asset, buffer);
    return asset;
  } catch (error) {
    await discardUpload(asset);
    throw error instanceof ApiError ? error : new ApiError(502, 'Image storage upload failed; please retry');
  }
};

export const attachImage = async (asset, session) => {
  const result = await MediaAsset.updateOne({ _id: asset._id, status: 'STAGED' }, { status: 'ATTACHED' }, { session });
  if (result.modifiedCount !== 1) throw new ApiError(409, 'Upload is no longer available');
};

export const discardUpload = async (asset) => {
  // Do not delete a committed asset after an ambiguous transaction response.
  await MediaAsset.updateOne({ _id: asset._id, status: 'STAGED' }, { status: 'DELETE_PENDING' });
};

export const cleanupMedia = async () => {
  const staleBefore = new Date(Date.now() - 60 * 60_000);
  await MediaAsset.updateMany({ status: 'STAGED', createdAt: { $lt: staleBefore } }, { status: 'DELETE_PENDING' });
  const assets = await MediaAsset.find({ status: 'DELETE_PENDING' }).limit(100);
  let deleted = 0;
  for (const asset of assets) {
    try {
      await mediaStorage.delete(asset);
      await MediaAsset.deleteOne({ _id: asset._id, status: 'DELETE_PENDING' });
      deleted += 1;
    } catch { /* Keep the durable pending record for the next cleanup run. */ }
  }
  return { deleted, pending: await MediaAsset.countDocuments({ status: 'DELETE_PENDING' }) };
};

export const sendImage = async (assetId, res, { publicGallery = false } = {}) => {
  const asset = await MediaAsset.findOne({ _id: assetId, status: 'ATTACHED' });
  if (!asset) throw new ApiError(404, 'Image not found');
  let object;
  try { object = await mediaStorage.get(asset); }
  catch (error) { throw error instanceof ApiError ? error : new ApiError(error.name === 'NoSuchKey' ? 404 : 502, 'Image is unavailable'); }
  res.set({ 'Content-Type': asset.contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': publicGallery ? 'cross-origin' : 'same-site' });
  await pipeline(object.Body, res);
};
