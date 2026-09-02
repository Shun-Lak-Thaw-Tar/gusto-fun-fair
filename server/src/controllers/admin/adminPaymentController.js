import { z } from 'zod';
import Payment from '../../models/Payment.js';
import ApiError from '../../utils/ApiError.js';
import { reviewPayment } from '../../services/paymentService.js';

const reviewSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), rejectionReason: z.string().trim().max(500).optional() }).refine((value) => value.decision !== 'REJECTED' || value.rejectionReason, { message: 'Rejection reason is required' });

export const listSubmittedPayments = async (_req, res) => res.json({ payments: await Payment.find({ status: 'SUBMITTED' }).populate('orderId userId', '-passwordHash') });

export const reviewSubmittedPayment = async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid review decision', z.treeifyError(parsed.error));
  res.json(await reviewPayment({ paymentId: req.params.id, adminId: req.user._id, ...parsed.data }));
};
