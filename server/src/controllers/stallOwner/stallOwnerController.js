import EventConfig from '../../models/EventConfig.js';
import StallFood from '../../models/StallFood.js';
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
  const foods = await StallFood.find({ stallId: user.stallId }).populate('foodId', 'name description category image isActive').lean();
  return foods.map(({ reservedTickets: _reserved, soldTickets: _sold, ...entry }) => ({ ...entry, stallFoodId: entry._id, food: entry.foodId, preorderPrice: calculatePreorderPrice(entry.eventDayPrice, entry.discount), ticketsRemaining: ticketsRemaining(entry) }));
};

export const getDashboard = async (req, res) => {
  const [stall, sales] = await Promise.all([getOwnedStall(req.user), getStallSales(req.user.stallId)]);
  res.json({ owner: { name: req.user.name, role: req.user.role, isActive: req.user.isActive }, stall, summary: sales.summary });
};
export const getMyStall = async (req, res) => res.json({ stall: await getOwnedStall(req.user) });
export const getMyFoods = async (req, res) => res.json({ foods: await getOwnedFoods(req.user) });
export const getMySales = async (req, res) => res.json(await getStallSales(req.user.stallId));
export const getShareData = async (req, res) => {
  const [stall, foods, event] = await Promise.all([getOwnedStall(req.user), StallFood.find({ stallId: req.user.stallId, isAvailable: true }).populate({ path: 'foodId', match: { isActive: true }, select: 'name' }).lean(), EventConfig.findOne({ configKey: 'current' }).select('eventName').lean()]);
  const publicPath = `/stalls/${stall.slug}`;
  res.json({ share: { eventName: event?.eventName || '', stallName: stall.stallName, batch: stall.batch, image: stall.image, foodNames: foods.filter((entry) => entry.foodId).map((entry) => entry.foodId.name), slug: stall.slug, publicPath } });
};
