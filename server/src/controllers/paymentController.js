import { z } from 'zod';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import ApiError from '../utils/ApiError.js';

const schema = z.object({ paymentProof: z.object({ url: z.string().trim().min(1), storageKey: z.string().trim().optional().default(''), provider: z.string().trim().optional().default('') }) });
export const submitPayment = async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'A payment proof reference is required', z.treeifyError(parsed.error));
  const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found');
  if (!['AWAITING_PAYMENT', 'PAYMENT_REJECTED'].includes(order.status)) throw new ApiError(409, 'Order cannot accept payment proof');
  const payment = await Payment.findOneAndUpdate({ orderId: order._id }, { $set: { userId: req.user._id, paymentMethod: 'KBZ', paymentProof: parsed.data.paymentProof, status: 'SUBMITTED', submittedAt: new Date() }, $unset: { reviewedBy: 1, reviewedAt: 1, rejectionReason: 1 } }, { upsert: true, new: true, runValidators: true });
  order.status = 'PAYMENT_SUBMITTED'; await order.save();
  res.status(201).json({ payment });
};
