import Food from '../../models/Food.js';
import StallFood from '../../models/StallFood.js';
import Order from '../../models/Order.js';
import Stall from '../../models/Stall.js';
import Ticket from '../../models/Ticket.js';

const aggregateTotal = (results) => results[0]?.total || 0;

export const getDashboard = async (_req, res) => {
  const [totalOrders, awaitingPayment, paymentDeclared, pendingPaymentReview, approvedOrders, rejectedOrders, expiredOrders, cancelledOrders, revenueResults, soldResults, digitalTicketsIssued, digitalTicketsRedeemed, physicalResults, activeStalls, availableFoodResults] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ status: 'AWAITING_PAYMENT' }),
    Order.countDocuments({ status: 'PAYMENT_DECLARED' }),
    Order.countDocuments({ status: 'PAYMENT_SUBMITTED' }),
    Order.countDocuments({ status: 'PAYMENT_APPROVED' }),
    Order.countDocuments({ status: 'PAYMENT_REJECTED' }),
    Order.countDocuments({ status: { $in: ['EXPIRED', 'PAYMENT_EVIDENCE_EXPIRED'] } }),
    Order.countDocuments({ status: 'CANCELLED' }),
    Order.aggregate([{ $match: { status: 'PAYMENT_APPROVED' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.aggregate([{ $match: { status: 'PAYMENT_APPROVED' } }, { $unwind: '$items' }, { $group: { _id: null, total: { $sum: '$items.quantity' } } }]),
    Ticket.countDocuments(),
    Ticket.countDocuments({ status: 'REDEEMED' }),
    Ticket.aggregate([{ $match: { status: 'REDEEMED' } }, { $lookup: { from: Order.collection.name, localField: 'orderId', foreignField: '_id', as: 'order' } }, { $unwind: '$order' }, { $group: { _id: null, total: { $sum: '$order.totalQuantity' } } }]),
    Stall.countDocuments({ isActive: true }),
    StallFood.aggregate([{ $match: { isAvailable: true } }, { $lookup: { from: Stall.collection.name, localField: 'stallId', foreignField: '_id', as: 'stall' } }, { $unwind: '$stall' }, { $lookup: { from: Food.collection.name, localField: 'foodId', foreignField: '_id', as: 'food' } }, { $unwind: '$food' }, { $match: { 'stall.isActive': true, 'food.isActive': true } }, { $count: 'total' }]),
  ]);

  res.json({ dashboard: {
    totalOrders,
    awaitingPayment,
    paymentDeclared,
    pendingPaymentReview,
    approvedOrders,
    rejectedOrders,
    expiredOrders,
    cancelledOrders,
    approvedRevenue: aggregateTotal(revenueResults),
    foodTicketsSold: aggregateTotal(soldResults),
    digitalTicketsIssued,
    digitalTicketsRedeemed,
    physicalTicketsIssued: aggregateTotal(physicalResults),
    activeStalls,
    availableFoodItems: aggregateTotal(availableFoodResults),
  } });
};
