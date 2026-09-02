import { z } from 'zod';
import FoodItem from '../models/FoodItem.js';
import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import { priceOrderItems } from '../services/pricingService.js';
import { assertInventoryAvailable } from '../services/inventoryService.js';

const schema = z.object({ items: z.array(z.object({ foodItemId: z.string().min(1), quantity: z.number().int().positive() })).min(1) });
export const createOrder = async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid order data', z.treeifyError(parsed.error));
  const ids = [...new Set(parsed.data.items.map((item) => item.foodItemId))];
  if (ids.length !== parsed.data.items.length) throw new ApiError(400, 'Each food item may appear only once');
  const foods = await FoodItem.find({ _id: { $in: ids } }).populate('stallId');
  if (foods.length !== ids.length) throw new ApiError(400, 'One or more food items do not exist');
  const items = priceOrderItems(parsed.data.items, foods);
  await assertInventoryAvailable(items);
  const order = await Order.create({ userId: req.user._id, items, totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0), totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0) });
  res.status(201).json({ order });
};
export const listMyOrders = async (req, res) => res.json({ orders: await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }) });
export const getMyOrder = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found');
  res.json({ order });
};
