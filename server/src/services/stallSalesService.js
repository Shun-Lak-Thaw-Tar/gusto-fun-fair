import mongoose from 'mongoose';
import Order from '../models/Order.js';

export const getStallSales = async (stallId) => {
  const id = new mongoose.Types.ObjectId(String(stallId));
  const foods = await Order.aggregate([
    { $match: { status: 'PAYMENT_APPROVED' } },
    { $unwind: '$items' },
    { $match: { 'items.stallId': id } },
    { $group: { _id: { $ifNull: ['$items.stallFoodId', '$items.foodItemId'] }, stallFoodId: { $first: '$items.stallFoodId' }, foodId: { $first: '$items.foodId' }, foodItemId: { $first: '$items.foodItemId' }, foodName: { $first: '$items.foodName' }, quantitySold: { $sum: '$items.quantity' }, approvedRevenue: { $sum: '$items.subtotal' } } },
    { $sort: { quantitySold: -1, foodName: 1 } },
    { $project: { _id: 0, stallFoodId: 1, foodId: 1, foodItemId: 1, legacyOrStallFoodId: '$_id', foodName: 1, quantitySold: 1, approvedRevenue: 1 } },
  ]);
  return {
    summary: { approvedRevenue: foods.reduce((sum, food) => sum + food.approvedRevenue, 0), foodTicketsSold: foods.reduce((sum, food) => sum + food.quantitySold, 0) },
    foods,
  };
};

// Scoped strictly to the caller's own stall; never trust a stallId from the request.
export const getStallOrders = async (stallId) => {
  const id = new mongoose.Types.ObjectId(String(stallId));
  const orders = await Order.find({ status: 'PAYMENT_APPROVED', 'items.stallId': id }).sort({ createdAt: -1 }).lean();
  const presented = orders.map((order) => {
    const items = order.items.filter((item) => String(item.stallId) === String(id)).map(({ foodName, quantity, unitPrice, subtotal }) => ({ foodName, quantity, unitPrice, subtotal }));
    return {
      orderId: order._id,
      paymentReference: order.paymentReference,
      status: order.status,
      createdAt: order.createdAt,
      items,
      stallQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      stallSubtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
    };
  });
  return { orders: presented, summary: { approvedOrderCount: presented.length } };
};
