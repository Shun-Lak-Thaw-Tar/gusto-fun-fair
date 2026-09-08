import mongoose from 'mongoose';

export const mediaSchemaDefinition = {
  url: { type: String, trim: true, default: '' },
  storageKey: { type: String, trim: true, default: '' },
  provider: { type: String, trim: true, default: '' },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
};
