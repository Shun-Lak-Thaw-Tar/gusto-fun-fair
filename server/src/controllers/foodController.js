import FoodItem from '../models/FoodItem.js';
import { calculatePreorderPrice } from '../services/pricingService.js';
import { ticketsRemaining } from '../services/inventoryService.js';
import { releaseExpiredReservations } from '../services/orderLifecycleService.js';

const present = (food) => {
  const { reservedTickets: _reserved, soldTickets: _sold, ...safeFood } = food;
  return { ...safeFood, ticketsRemaining: ticketsRemaining(food), preorderPrice: calculatePreorderPrice(food.eventDayPrice, food.stallId.discount) };
};
export const listFoods = async (req, res) => {
  await releaseExpiredReservations();
  const query = { isAvailable: true, ...(req.query.stallId ? { stallId: req.query.stallId } : {}) };
  const foods = await FoodItem.find(query).populate({ path: 'stallId', match: { isActive: true }, select: 'stallName batch discount isActive' }).sort({ name: 1 }).lean();
  res.json({ foods: foods.filter((food) => food.stallId).map(present) });
};
export const getFood = async (req, res) => {
  const food = await FoodItem.findOne({ _id: req.params.id, isAvailable: true }).populate({ path: 'stallId', match: { isActive: true }, select: 'stallName batch discount isActive' }).orFail();
  if (!food.stallId) return res.status(404).json({ error: { message: 'Food item not found' } });
  return res.json({ food: present(food.toObject()) });
};
