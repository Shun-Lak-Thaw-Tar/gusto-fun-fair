import Food from '../models/Food.js';
import StallFood from '../models/StallFood.js';

const hasImage = (image) => Boolean(image?.url || image?.storageKey);
const copyImage = (image) => hasImage(image) ? { url: image.url || '', storageKey: image.storageKey || '', provider: image.provider || '' } : null;

// Enrich older orders for display only. Never replace names, prices or stored items.
export const presentOrderWithImages = async (order) => {
  const value = typeof order.toObject === 'function' ? order.toObject() : order;
  const missing = value.items.filter(item => !hasImage(item.foodImage));
  const entryIds = missing.filter(item => !item.foodId && item.stallFoodId).map(item => item.stallFoodId);
  const entries = entryIds.length ? await StallFood.find({ _id: { $in: entryIds } }).select('_id foodId').lean() : [];
  const byEntry = new Map(entries.map(entry => [String(entry._id), entry.foodId]));
  const foodIdFor = item => item.foodId || byEntry.get(String(item.stallFoodId));
  const foodIds = [...new Set(missing.map(foodIdFor).filter(Boolean).map(String))];
  // Include inactive foods: a past purchase must not depend on the public menu.
  const foods = foodIds.length ? await Food.find({ _id: { $in: foodIds } }).select('_id image').lean() : [];
  const byFood = new Map(foods.map(food => [String(food._id), food.image]));
  return { ...value, items: value.items.map(item => ({ ...item, foodImage: copyImage(hasImage(item.foodImage) ? item.foodImage : byFood.get(String(foodIdFor(item)))) })) };
};
