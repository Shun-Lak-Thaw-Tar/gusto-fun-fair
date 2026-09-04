import { z } from 'zod';
import Payment from '../../models/Payment.js';
import ApiError from '../../utils/ApiError.js';
import { reviewPayment } from '../../services/paymentService.js';
import { presentPayment } from '../paymentController.js';

const reviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'REUPLOAD_REQUESTED']),
  proofVersion: z.number().int().min(0),
  reason: z.string().trim().max(500).optional(),
  rejectionReason: z.string().trim().max(500).optional(),
}).strict().refine(value => value.decision === 'APPROVED' || value.reason || value.rejectionReason, { message: 'Review reason is required' });

export const listSubmittedPayments = async (_req, res) => {
  const rows = await Payment.find({ status: { $in: ['SUBMITTED', 'REUPLOAD_REQUESTED'] } }).populate('orderId userId', '-passwordHash').sort({ submittedAt: 1 });
  res.json({ payments: rows.map(payment => ({ ...presentPayment(payment), order: payment.orderId, user: payment.userId })) });
};
export const reviewSubmittedPayment = async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Send a decision, current proofVersion, and a reason for rejection or reupload', z.treeifyError(parsed.error));
  const result = await reviewPayment({ paymentId: req.params.id, adminId: req.user._id, ...parsed.data });
  res.json({ ...result, payment: presentPayment(result.payment) });
};
