import mongoose from 'mongoose';
import Order from '../models/Order.js';

export const getStallSales = async (stallId) => {
  const id = new mongoose.Types.ObjectId(String(stallId));
  const foods = await Order.aggregate([
    { $match: { status: 'PAYMENT_APPROVED' } },
    { $unwind: '$items' },
    { $match: { 'items.stallId': id } },
    { $group: { _id: '$items.foodItemId', foodName: { $first: '$items.foodName' }, quantitySold: { $sum: '$items.quantity' }, approvedRevenue: { $sum: '$items.subtotal' } } },
    { $sort: { quantitySold: -1, foodName: 1 } },
    { $project: { _id: 0, foodItemId: '$_id', foodName: 1, quantitySold: 1, approvedRevenue: 1 } },
  ]);
  return {
    summary: { approvedRevenue: foods.reduce((sum, food) => sum + food.approvedRevenue, 0), foodTicketsSold: foods.reduce((sum, food) => sum + food.quantitySold, 0) },
    foods,
  };
};
