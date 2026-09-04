import { z } from 'zod';
import FoodItem from '../models/FoodItem.js';
import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import { priceOrderItems } from '../services/pricingService.js';
import { releaseInventory, reserveInventory } from '../services/inventoryService.js';
import { assertOrderingOpen, getCurrentEvent, presentEvent } from '../services/eventService.js';
import { cancelOrder as cancelOrderReservation, declarePayment, releaseExpiredReservations } from '../services/orderLifecycleService.js';
import generatePaymentReference from '../utils/generatePaymentReference.js';

const schema = z.object({ items: z.array(z.object({ foodItemId: z.string().min(1), quantity: z.number().int().positive() })).min(1) });
export const createOrder = async (req, res) => {
  await releaseExpiredReservations();
  const config = await getCurrentEvent();
  assertOrderingOpen(config);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid order data', z.treeifyError(parsed.error));
  const consolidated = [...parsed.data.items.reduce((map, item) => map.set(item.foodItemId, { foodItemId: item.foodItemId, quantity: (map.get(item.foodItemId)?.quantity || 0) + item.quantity }), new Map()).values()];
  const ids = consolidated.map((item) => item.foodItemId);
  const foods = await FoodItem.find({ _id: { $in: ids } }).populate('stallId');
  if (foods.length !== ids.length) throw new ApiError(400, 'One or more food items do not exist');
  const items = priceOrderItems(consolidated, foods);
  await reserveInventory(items);
  try {
    const now = new Date();
    const order = await Order.create({ eventId: config._id, userId: req.user._id, items, totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0), totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0), paymentReference: generatePaymentReference(), reservationExpiresAt: new Date(now.getTime() + config.orderReservationMinutes * 60_000) });
    res.status(201).json({ order, payment: { amount: order.totalAmount, reference: order.paymentReference, reservationExpiresAt: order.reservationExpiresAt, ...presentEvent(config, now, true) } });
  } catch (error) {
    await releaseInventory(items);
    throw error;
  }
};
export const listMyOrders = async (req, res) => res.json({ orders: await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }) });
export const getMyOrder = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found');
  res.json({ order });
};
export const declareMyPayment = async (req, res) => {
  await releaseExpiredReservations();
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found');
  res.json({ order: await declarePayment(order) });
};
export const cancelMyOrder = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found');
  res.json({ order: await cancelOrderReservation(order) });
};
