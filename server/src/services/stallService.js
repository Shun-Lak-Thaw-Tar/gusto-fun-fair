import Stall from '../models/Stall.js';
import { slugify } from '../utils/slugify.js';

export const findAvailableSlug = async (name, excludedId) => {
  const base = slugify(name);
  for (let suffix = 1; suffix <= 1000; suffix += 1) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    const exists = await Stall.exists({ slug, ...(excludedId ? { _id: { $ne: excludedId } } : {}) });
    if (!exists) return slug;
  }
  throw new Error('Unable to allocate a unique stall slug');
};

export const createStall = async (data) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const base = await findAvailableSlug(data.slug || data.stallName);
      return await Stall.create({ ...data, slug: attempt ? `${base}-${attempt + 1}` : base });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new Error('Unable to create a stall with a unique slug');
};
