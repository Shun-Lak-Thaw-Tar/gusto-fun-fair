import EventConfig from '../../models/EventConfig.js';
import FoodItem from '../../models/FoodItem.js';
import Stall from '../../models/Stall.js';
import ApiError from '../../utils/ApiError.js';
import { ticketsRemaining } from '../../services/inventoryService.js';
import { calculatePreorderPrice } from '../../services/pricingService.js';
import { getStallSales } from '../../services/stallSalesService.js';

const getOwnedStall = async (user) => {
  const stall = await Stall.findById(user.stallId).lean();
  if (!stall) throw new ApiError(404, 'Linked stall not found');
  return stall;
};
const getOwnedFoods = async (user) => {
  const stall = await Stall.findById(user.stallId).lean();
  if (!stall) throw new ApiError(404, 'Linked stall not found');
  const foods = await FoodItem.find({ stallId: user.stallId }).sort({ name: 1 }).lean();
  return foods.map(({ reservedTickets: _reserved, soldTickets: _sold, ...food }) => ({ ...food, preorderPrice: calculatePreorderPrice(food.eventDayPrice, stall.discount), ticketsRemaining: ticketsRemaining(food) }));
};

export const getDashboard = async (req, res) => {
  const [stall, sales] = await Promise.all([getOwnedStall(req.user), getStallSales(req.user.stallId)]);
  res.json({ owner: { name: req.user.name, role: req.user.role, isActive: req.user.isActive }, stall, summary: sales.summary });
};
export const getMyStall = async (req, res) => res.json({ stall: await getOwnedStall(req.user) });
export const getMyFoods = async (req, res) => res.json({ foods: await getOwnedFoods(req.user) });
export const getMySales = async (req, res) => res.json(await getStallSales(req.user.stallId));
export const getShareData = async (req, res) => {
  const [stall, foods, event] = await Promise.all([getOwnedStall(req.user), FoodItem.find({ stallId: req.user.stallId, isAvailable: true }).sort({ name: 1 }).select('name').lean(), EventConfig.findOne({ configKey: 'current' }).select('eventName').lean()]);
  const publicPath = `/stalls/${stall.slug}`;
  res.json({ share: { eventName: event?.eventName || '', stallName: stall.stallName, batch: stall.batch, image: stall.image, discount: stall.discount, foodNames: foods.map((food) => food.name), slug: stall.slug, publicPath } });
};
