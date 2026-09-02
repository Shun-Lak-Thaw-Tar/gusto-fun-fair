import Notification from '../models/Notification.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import ApiError from '../utils/ApiError.js';
import { createTicketForOrder } from './ticketService.js';
import { convertReservedToSold, releaseInventory, reserveInventory, revertSoldToReserved } from './inventoryService.js';

export const reviewPayment = async ({ paymentId, decision, adminId, rejectionReason }) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');
  const approved = decision === 'APPROVED';
  const order = await Order.findById(payment.orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  const finalPaymentStatus = approved ? 'APPROVED' : 'REJECTED';
  const finalOrderStatus = approved ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED';
  const finalInventoryStatus = approved ? 'SOLD' : 'RELEASED';
  const ensureNotification = () => Notification.updateOne({ orderId: order._id, type: `PAYMENT_${finalPaymentStatus}` }, { $setOnInsert: { userId: payment.userId, orderId: order._id, type: `PAYMENT_${finalPaymentStatus}`, title: approved ? 'Your Fun Fair ticket is ready' : 'Payment rejected', message: approved ? 'Your payment was approved and your digital ticket is ready.' : `Your payment proof was rejected.${rejectionReason ? ` ${rejectionReason}` : ''} No automatic refund is issued.` } }, { upsert: true });
  if (payment.status === finalPaymentStatus && order.status === finalOrderStatus && order.inventoryStatus === finalInventoryStatus) {
    const ticket = approved ? await createTicketForOrder(order) : undefined;
    await ensureNotification();
    return { payment, order, ticket };
  }
  if (payment.status !== 'SUBMITTED' || order.status !== 'PAYMENT_SUBMITTED' || order.inventoryStatus !== 'RESERVED') throw new ApiError(409, 'Payment is not awaiting this review decision');

  const claimed = await Order.findOneAndUpdate({ _id: order._id, status: 'PAYMENT_SUBMITTED', inventoryStatus: 'RESERVED' }, { status: finalOrderStatus, inventoryStatus: finalInventoryStatus }, { new: true });
  if (!claimed) throw new ApiError(409, 'Payment review is already being processed');
  let updatedPayment;
  try {
    if (approved) await convertReservedToSold(order.items);
    else await releaseInventory(order.items);
    updatedPayment = await Payment.findOneAndUpdate({ _id: payment._id, status: 'SUBMITTED' }, { status: finalPaymentStatus, reviewedBy: adminId, reviewedAt: new Date(), rejectionReason: approved ? undefined : rejectionReason }, { new: true });
    if (!updatedPayment) throw new Error('Payment changed during review');
  } catch (error) {
    if (approved) await revertSoldToReserved(order.items);
    else await reserveInventory(order.items);
    await Payment.updateOne({ _id: payment._id, status: finalPaymentStatus }, { status: 'SUBMITTED', $unset: { reviewedBy: 1, reviewedAt: 1, rejectionReason: 1 } });
    await Order.updateOne({ _id: order._id, status: finalOrderStatus, inventoryStatus: finalInventoryStatus }, { status: 'PAYMENT_SUBMITTED', inventoryStatus: 'RESERVED' });
    throw error;
  }
  // Durable, uniquely indexed side effects can safely be retried without repeating inventory changes.
  const ticket = approved ? await createTicketForOrder(claimed) : undefined;
  await ensureNotification();
  return { payment: updatedPayment, order: claimed, ticket };
};
