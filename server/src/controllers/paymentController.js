import { z } from 'zod';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import ApiError from '../utils/ApiError.js';
import { releaseOrderReservation } from '../services/orderLifecycleService.js';

const schema = z.object({ paymentProof: z.object({ url: z.string().trim().min(1), storageKey: z.string().trim().optional().default(''), provider: z.string().trim().optional().default('') }) });
export const submitPayment = async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'A payment proof reference is required', z.treeifyError(parsed.error));
  const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'PAYMENT_DECLARED' || order.inventoryStatus !== 'RESERVED') throw new ApiError(409, 'Payment proof can be submitted only after payment declaration');
  const now = new Date();
  if (now >= order.paymentProofExpiresAt) {
    await releaseOrderReservation(order._id, 'PAYMENT_DECLARED', 'PAYMENT_EVIDENCE_EXPIRED');
    throw new ApiError(410, 'Payment-proof upload period has expired');
  }
  const claimed = await Order.findOneAndUpdate({ _id: order._id, status: 'PAYMENT_DECLARED', inventoryStatus: 'RESERVED', paymentProofExpiresAt: { $gt: now } }, { status: 'PAYMENT_SUBMITTED' }, { new: true });
  if (!claimed) throw new ApiError(409, 'Order changed before proof submission');
  try {
    const payment = await Payment.findOneAndUpdate({ orderId: order._id }, { $set: { userId: req.user._id, paymentMethod: 'KBZ', paymentProof: parsed.data.paymentProof, status: 'SUBMITTED', submittedAt: now }, $unset: { reviewedBy: 1, reviewedAt: 1, rejectionReason: 1 } }, { upsert: true, new: true, runValidators: true });
    res.status(201).json({ order: claimed, payment });
  } catch (error) {
    await Order.updateOne({ _id: order._id, status: 'PAYMENT_SUBMITTED' }, { status: 'PAYMENT_DECLARED' });
    throw error;
  }
};
