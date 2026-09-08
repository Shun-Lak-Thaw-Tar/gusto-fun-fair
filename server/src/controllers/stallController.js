import Stall from '../models/Stall.js';
import StallFood from '../models/StallFood.js';
import { presentStallFood } from './foodController.js';
import { releaseExpiredReservations } from '../services/orderLifecycleService.js';
export const listStalls = async (_req, res) => res.json({ stalls: await Stall.find({ isActive: true }).sort({ stallName: 1 }).lean() });
export const getStall = async (req, res) => res.json({ stall: await Stall.findOne({ _id: req.params.id, isActive: true }).orFail() });
export const getStallBySlug = async (req, res) => {
  await releaseExpiredReservations();
  const stall = await Stall.findOne({ slug: req.params.slug.toLowerCase(), isActive: true }).lean();
  if (!stall) return res.status(404).json({ error: { message: 'Stall not found' } });
  const foods = await StallFood.find({ stallId: stall._id, isAvailable: true }).populate({ path: 'foodId', match: { isActive: true } }).lean();
  res.json({ stall, foods: foods.filter((entry) => entry.foodId).map((entry) => presentStallFood({ ...entry, stallId: stall })) });
};
