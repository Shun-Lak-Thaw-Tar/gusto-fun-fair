import { z } from 'zod';
import StallFood from '../models/StallFood.js';
import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import { priceOrderItems } from '../services/pricingService.js';
import { releaseInventory, reserveInventory } from '../services/inventoryService.js';
import { assertOrderingOpen, getCurrentEvent, presentEvent } from '../services/eventService.js';
import { cancelOrder as cancelOrderReservation, declarePayment, releaseExpiredReservations } from '../services/orderLifecycleService.js';
import generatePaymentReference from '../utils/generatePaymentReference.js';

const requestedItemSchema = z.object({ stallFoodId: z.string().regex(/^[a-f\d]{24}$/i).optional(), foodItemId: z.string().regex(/^[a-f\d]{24}$/i).optional(), quantity: z.number().int().positive() }).strict().refine((item) => Boolean(item.stallFoodId) !== Boolean(item.foodItemId), { message: 'Provide exactly one stallFoodId; foodItemId is deprecated compatibility input' });
const schema = z.object({ items: z.array(requestedItemSchema).min(1) }).strict();
export const createOrder = async (req, res) => {
  await releaseExpiredReservations();
  const config = await getCurrentEvent();
  assertOrderingOpen(config);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid order data', z.treeifyError(parsed.error));
  const canonicalIds = parsed.data.items.flatMap((item) => item.stallFoodId ? [item.stallFoodId] : []);
  const legacyIds = parsed.data.items.flatMap((item) => item.foodItemId ? [item.foodItemId] : []);
  const entries = await StallFood.find({ $or: [{ _id: { $in: canonicalIds } }, { legacyFoodItemId: { $in: legacyIds } }] }).populate('stallId').populate('foodId');
  const byCanonical = new Map(entries.map((entry) => [String(entry._id), entry]));
  const byLegacy = new Map(entries.filter((entry) => entry.legacyFoodItemId).map((entry) => [String(entry.legacyFoodItemId), entry]));
  const consolidatedMap = new Map();
  for (const requested of parsed.data.items) {
    const entry = requested.stallFoodId ? byCanonical.get(requested.stallFoodId) : byLegacy.get(requested.foodItemId);
    if (!entry) throw new ApiError(400, 'One or more stall foods do not exist');
    const id = String(entry._id);
    consolidatedMap.set(id, { stallFoodId: id, quantity: (consolidatedMap.get(id)?.quantity || 0) + requested.quantity });
  }
  const consolidated = [...consolidatedMap.values()];
  const items = priceOrderItems(consolidated, entries);
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
