import Notification from '../models/Notification.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import ApiError from '../utils/ApiError.js';
import { createTicketForOrder } from './ticketService.js';

export const reviewPayment = async ({ paymentId, decision, adminId, rejectionReason }) => {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.status !== 'SUBMITTED') throw new ApiError(409, 'Payment is not awaiting review');
  const approved = decision === 'APPROVED';
  const order = await Order.findById(payment.orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  let ticket;
  // The unique orderId index makes retries idempotent without requiring a replica-set transaction.
  if (approved) ticket = await createTicketForOrder(order);
  payment.status = approved ? 'APPROVED' : 'REJECTED';
  payment.reviewedBy = adminId; payment.reviewedAt = new Date(); payment.rejectionReason = approved ? undefined : rejectionReason;
  order.status = approved ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED';
  await Promise.all([payment.save(), order.save()]);
  await Notification.create({ userId: payment.userId, type: `PAYMENT_${payment.status}`, title: approved ? 'Your Fun Fair ticket is ready' : 'Payment rejected', message: approved ? 'Your payment was approved and your digital ticket is ready.' : `Your payment was rejected.${rejectionReason ? ` ${rejectionReason}` : ''}` });
  return { payment, order, ticket };
};
