import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import ApiError from '../utils/ApiError.js';
import { createTicketForOrder } from './ticketService.js';
import { settleReservedInventory } from './inventoryService.js';

export const reviewPayment = async ({ paymentId, decision, adminId, rejectionReason, reason, proofVersion }) => {
  const reviewReason = (reason || rejectionReason || '').trim();
  if (!['APPROVED', 'REJECTED', 'REUPLOAD_REQUESTED'].includes(decision)) throw new ApiError(400, 'Invalid review decision');
  if (decision !== 'APPROVED' && (!reviewReason || reviewReason.length > 500)) throw new ApiError(400, 'A reason of at most 500 characters is required');
  return mongoose.connection.transaction(async (session) => {
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) throw new ApiError(404, 'Payment not found');
    const order = await Order.findById(payment.orderId).session(session);
    if (!order) throw new ApiError(404, 'Order not found');
    if (proofVersion !== undefined && proofVersion !== payment.proofVersion) throw new ApiError(409, 'Proof changed; reload it before reviewing');
    const finalOrderStatus = { APPROVED: 'PAYMENT_APPROVED', REJECTED: 'PAYMENT_REJECTED', REUPLOAD_REQUESTED: 'PAYMENT_REUPLOAD_REQUESTED' }[decision];
    if (payment.status === decision && order.status === finalOrderStatus) {
      return { payment, order, ...(decision === 'APPROVED' ? { ticket: await createTicketForOrder(order, session) } : {}) };
    }
    // Final rejection can also close an indefinitely pending replacement request.
    const allowedStatus = decision === 'REJECTED' && payment.status === 'REUPLOAD_REQUESTED' ? 'REUPLOAD_REQUESTED' : 'SUBMITTED';
    const expectedOrder = allowedStatus === 'SUBMITTED' ? 'PAYMENT_SUBMITTED' : 'PAYMENT_REUPLOAD_REQUESTED';
    if (payment.status !== allowedStatus || order.status !== expectedOrder || order.inventoryStatus !== 'RESERVED') throw new ApiError(409, 'Payment is not awaiting this review decision');
    if (decision !== 'REUPLOAD_REQUESTED') await settleReservedInventory(order.items, decision === 'APPROVED', session);
    order.status = finalOrderStatus;
    order.inventoryStatus = decision === 'REUPLOAD_REQUESTED' ? 'RESERVED' : decision === 'APPROVED' ? 'SOLD' : 'RELEASED';
    await order.save({ session });
    payment.status = decision;
    payment.reviewedBy = adminId;
    payment.reviewedAt = new Date();
    payment.rejectionReason = decision === 'REJECTED' ? reviewReason : undefined;
    payment.reuploadReason = decision === 'REUPLOAD_REQUESTED' ? reviewReason : undefined;
    payment.reviewHistory.push({ decision, reason: reviewReason, proofVersion: payment.proofVersion, reviewedBy: adminId, reviewedAt: payment.reviewedAt });
    await payment.save({ session });
    const title = decision === 'APPROVED' ? 'Your Fun Fair ticket is ready' : decision === 'REJECTED' ? 'Payment rejected' : 'Please upload another payment screenshot';
    const message = decision === 'APPROVED' ? 'Your payment was approved and your digital ticket is ready.' : decision === 'REJECTED' ? `${reviewReason} No automatic refund is issued.` : reviewReason;
    await Notification.updateOne({ orderId: order._id, type: `PAYMENT_${decision}` }, { $set: { userId: payment.userId, orderId: order._id, title, message, isRead: false } }, { upsert: true, session });
    const ticket = decision === 'APPROVED' ? await createTicketForOrder(order, session) : undefined;
    return { payment, order, ticket };
  });
};
