import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import { getCurrentEvent } from './eventService.js';
import { releaseInventory } from './inventoryService.js';

export const releaseOrderReservation = async (orderId, expectedStatus, finalStatus) => {
  const order = await Order.findOneAndUpdate({ _id: orderId, status: expectedStatus, inventoryStatus: 'RESERVED' }, { status: finalStatus, inventoryStatus: 'RELEASED' }, { new: true });
  if (!order) return null;
  try {
    await releaseInventory(order.items);
    return order;
  } catch (error) {
    await Order.updateOne({ _id: order._id, status: finalStatus, inventoryStatus: 'RELEASED' }, { status: expectedStatus, inventoryStatus: 'RESERVED' });
    throw error;
  }
};

export const releaseExpiredReservations = async (now = new Date()) => {
  const normal = await Order.find({ status: 'AWAITING_PAYMENT', inventoryStatus: 'RESERVED', reservationExpiresAt: { $lte: now } }).select('_id');
  const evidence = await Order.find({ status: 'PAYMENT_DECLARED', inventoryStatus: 'RESERVED', paymentProofExpiresAt: { $lte: now } }).select('_id');
  let released = 0;
  for (const order of normal) if (await releaseOrderReservation(order._id, 'AWAITING_PAYMENT', 'EXPIRED')) released += 1;
  for (const order of evidence) if (await releaseOrderReservation(order._id, 'PAYMENT_DECLARED', 'PAYMENT_EVIDENCE_EXPIRED')) released += 1;
  return released;
};

export const declarePayment = async (order, now = new Date()) => {
  if (order.status !== 'AWAITING_PAYMENT' || order.inventoryStatus !== 'RESERVED') throw new ApiError(409, 'Order cannot declare payment in its current state');
  if (now >= order.reservationExpiresAt) {
    await releaseOrderReservation(order._id, 'AWAITING_PAYMENT', 'EXPIRED');
    throw new ApiError(410, 'Order reservation has expired');
  }
  const config = await getCurrentEvent();
  const paymentProofExpiresAt = new Date(now.getTime() + config.paymentProofGraceMinutes * 60_000);
  const updated = await Order.findOneAndUpdate({ _id: order._id, status: 'AWAITING_PAYMENT', inventoryStatus: 'RESERVED', reservationExpiresAt: { $gt: now } }, { status: 'PAYMENT_DECLARED', paymentDeclaredAt: now, paymentProofExpiresAt }, { new: true });
  if (!updated) throw new ApiError(409, 'Payment was already declared or the order changed');
  return updated;
};

export const cancelOrder = async (order) => {
  if (order.status !== 'AWAITING_PAYMENT' || order.inventoryStatus !== 'RESERVED') throw new ApiError(409, 'Cancellation is allowed only before payment is declared; payments are non-refundable');
  const cancelled = await releaseOrderReservation(order._id, 'AWAITING_PAYMENT', 'CANCELLED');
  if (!cancelled) throw new ApiError(409, 'Order was already cancelled or changed');
  return cancelled;
};
