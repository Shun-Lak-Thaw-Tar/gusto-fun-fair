import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import ApiError from '../utils/ApiError.js';
import { releaseOrderReservation } from '../services/orderLifecycleService.js';
import { attachImage, discardUpload, sendImage, uploadImage } from '../services/mediaService.js';

const checkUploadState = (order, now = new Date()) => {
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.inventoryStatus !== 'RESERVED' || !['PAYMENT_DECLARED', 'PAYMENT_REUPLOAD_REQUESTED'].includes(order.status)) throw new ApiError(409, 'Proof upload is not currently allowed for this order');
  if (order.status === 'PAYMENT_DECLARED' && (!order.paymentProofExpiresAt || now >= order.paymentProofExpiresAt)) throw new ApiError(410, 'Payment-proof upload period has expired');
};

export const presentPayment = (payment) => ({
  id: payment._id, orderId: payment.orderId, status: payment.status, proofVersion: payment.proofVersion,
  canReupload: payment.status === 'REUPLOAD_REQUESTED', reuploadReason: payment.reuploadReason || null,
  rejectionReason: payment.rejectionReason || null, submittedAt: payment.submittedAt,
  proofs: payment.proofs.map(proof => ({ version: proof.version, submittedAt: proof.submittedAt, imageUrl: `/api/payments/${payment._id}/proofs/${proof.version}` })),
  reviewHistory: payment.reviewHistory,
});

export const submitPayment = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id });
  try { checkUploadState(order); }
  catch (error) {
    if (error.statusCode === 410) await releaseOrderReservation(order._id, 'PAYMENT_DECLARED', 'PAYMENT_EVIDENCE_EXPIRED');
    throw error;
  }
  const previous = await Payment.findOne({ orderId: order._id });
  const expectedVersion = previous?.proofVersion || 0;
  const asset = await uploadImage({ file: req.file, userId: req.user._id, purpose: 'proofs' });
  try {
    const result = await mongoose.connection.transaction(async (session) => {
      const current = await Order.findOne({ _id: order._id, userId: req.user._id }).session(session);
      checkUploadState(current);
      if (current.status !== order.status) throw new ApiError(409, 'Order changed during upload');
      const replacing = current.status === 'PAYMENT_REUPLOAD_REQUESTED';
      let payment = await Payment.findOne({ orderId: current._id }).session(session);
      if ((payment?.proofVersion || 0) !== expectedVersion) throw new ApiError(409, 'This upload chance has already been used');
      if (replacing && payment?.status !== 'REUPLOAD_REQUESTED') throw new ApiError(409, 'No replacement upload has been granted');
      if (!replacing && payment) throw new ApiError(409, 'A payment proof has already been submitted');
      payment ||= new Payment({ orderId: current._id, userId: req.user._id });
      payment.proofVersion += 1;
      payment.submittedAt = new Date();
      payment.proofs.push({ assetId: asset._id, version: payment.proofVersion, submittedAt: payment.submittedAt });
      // Keep the shared field, but never accept a caller-supplied URL or storage key.
      payment.paymentProof = { provider: 'r2', storageKey: asset.storageKey, url: '' };
      payment.status = 'SUBMITTED';
      payment.reuploadReason = undefined;
      payment.rejectionReason = undefined;
      payment.reviewedBy = undefined;
      payment.reviewedAt = undefined;
      await payment.save({ session });
      current.status = 'PAYMENT_SUBMITTED';
      await current.save({ session });
      await attachImage(asset, session);
      return { order: current, payment: presentPayment(payment) };
    });
    res.status(201).json(result);
  } catch (error) {
    await discardUpload(asset);
    if (error.statusCode === 410) await releaseOrderReservation(order._id, 'PAYMENT_DECLARED', 'PAYMENT_EVIDENCE_EXPIRED');
    throw error;
  }
};

export const getMyPayment = async (req, res) => {
  const payment = await Payment.findOne({ orderId: req.params.orderId, userId: req.user._id });
  if (!payment) throw new ApiError(404, 'Payment not found');
  res.json({ payment: presentPayment(payment) });
};

export const getPaymentProof = async (req, res) => {
  const version = Number(req.params.version);
  if (!Number.isSafeInteger(version) || version < 1) throw new ApiError(400, 'Invalid proof version');
  const payment = await Payment.findOne({ _id: req.params.id, ...(req.user.role === 'admin' ? {} : { userId: req.user._id }) });
  const proof = payment?.proofs.find(item => item.version === version);
  if (!proof) throw new ApiError(404, 'Payment proof not found');
  await sendImage(proof.assetId, res);
};
