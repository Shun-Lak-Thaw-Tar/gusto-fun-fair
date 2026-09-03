import Stall from '../models/Stall.js';
import FoodItem from '../models/FoodItem.js';
import { calculatePreorderPrice } from '../services/pricingService.js';
import { ticketsRemaining } from '../services/inventoryService.js';
import { releaseExpiredReservations } from '../services/orderLifecycleService.js';
export const listStalls = async (_req, res) => res.json({ stalls: await Stall.find({ isActive: true }).sort({ stallName: 1 }).lean() });
export const getStall = async (req, res) => res.json({ stall: await Stall.findOne({ _id: req.params.id, isActive: true }).orFail() });
export const getStallBySlug = async (req, res) => {
  await releaseExpiredReservations();
  const stall = await Stall.findOne({ slug: req.params.slug.toLowerCase(), isActive: true }).lean();
  if (!stall) return res.status(404).json({ error: { message: 'Stall not found' } });
  const foods = await FoodItem.find({ stallId: stall._id, isAvailable: true }).sort({ name: 1 }).lean();
  res.json({ stall, foods: foods.map(({ reservedTickets: _reserved, soldTickets: _sold, ...food }) => ({ ...food, preorderPrice: calculatePreorderPrice(food.eventDayPrice, stall.discount), ticketsRemaining: ticketsRemaining(food) })) });
};
