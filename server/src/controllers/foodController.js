import Food from '../models/Food.js';
import StallFood from '../models/StallFood.js';
import ApiError from '../utils/ApiError.js';
import { calculatePreorderPrice } from '../services/pricingService.js';
import { ticketsRemaining } from '../services/inventoryService.js';
import { sendImage } from '../services/mediaService.js';
import { releaseExpiredReservations } from '../services/orderLifecycleService.js';

export const presentStallFood = (entry) => ({
  stallFoodId: String(entry._id), stallId: String(entry.stallId._id), foodId: String(entry.foodId._id), stallName: entry.stallId.stallName,
  food: { name: entry.foodId.name, description: entry.foodId.description, category: entry.foodId.category, image: entry.foodId.image },
  eventDayPrice: entry.eventDayPrice, discount: entry.discount, preorderPrice: calculatePreorderPrice(entry.eventDayPrice, entry.discount),
  ticketLimit: entry.ticketLimit, ticketsRemaining: ticketsRemaining(entry), isAvailable: entry.isAvailable,
});

export const listFoods = async (req, res) => {
  await releaseExpiredReservations();
  const query = { isAvailable: true, ...(req.query.stallId ? { stallId: req.query.stallId } : {}), ...(req.query.foodId ? { foodId: req.query.foodId } : {}) };
  const entries = await StallFood.find(query).populate({ path: 'stallId', match: { isActive: true } }).populate({ path: 'foodId', match: { isActive: true } }).sort({ createdAt: 1 }).lean();
  res.json({ foods: entries.filter((entry) => entry.stallId && entry.foodId).map(presentStallFood) });
};
export const getFood = async (req, res) => {
  const entry = await StallFood.findOne({ _id: req.params.id, isAvailable: true }).populate({ path: 'stallId', match: { isActive: true } }).populate({ path: 'foodId', match: { isActive: true } }).lean();
  if (!entry?.stallId || !entry?.foodId) throw new ApiError(404, 'Stall food not found');
  res.json({ food: presentStallFood(entry) });
};
// :id here is the Food catalog id, unlike the StallFood id used by the routes above.
export const getFoodImage = async (req, res) => {
  const food = await Food.findById(req.params.id).lean();
  if (!food?.image?.assetId) throw new ApiError(404, 'Image not found');
  await sendImage(food.image.assetId, res, { publicGallery: true });
};
