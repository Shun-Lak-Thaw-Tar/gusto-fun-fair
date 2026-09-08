import Order from '../../models/Order.js';
import { getDashboard } from './adminDashboardController.js';

export const statisticsOverview = getDashboard;

export const salesByStall = async (_req, res) => res.json({ stalls: await Order.aggregate([
  { $match: { status: 'PAYMENT_APPROVED' } },
  { $unwind: '$items' },
  { $group: { _id: '$items.stallId', stallId: { $first: '$items.stallId' }, stallName: { $first: '$items.stallName' }, approvedQuantity: { $sum: '$items.quantity' }, approvedRevenue: { $sum: '$items.subtotal' } } },
  { $project: { _id: 0, stallId: 1, stallName: 1, approvedQuantity: 1, approvedRevenue: 1 } },
  { $sort: { approvedQuantity: -1, approvedRevenue: -1, stallName: 1 } },
]) });

export const salesByFood = async (_req, res) => res.json({ foods: await Order.aggregate([
  { $match: { status: 'PAYMENT_APPROVED' } },
  { $unwind: '$items' },
  { $group: { _id: { $ifNull: ['$items.stallFoodId', '$items.foodItemId'] }, stallFoodId: { $first: '$items.stallFoodId' }, foodId: { $first: '$items.foodId' }, foodItemId: { $first: '$items.foodItemId' }, foodName: { $first: '$items.foodName' }, stallId: { $first: '$items.stallId' }, stallName: { $first: '$items.stallName' }, approvedQuantity: { $sum: '$items.quantity' }, approvedRevenue: { $sum: '$items.subtotal' } } },
  { $project: { _id: 0, stallFoodId: 1, foodId: 1, foodItemId: 1, foodName: 1, stallId: 1, stallName: 1, approvedQuantity: 1, approvedRevenue: 1 } },
  { $sort: { approvedQuantity: -1, approvedRevenue: -1, foodName: 1 } },
]) });

export const bestSellingStall = async (_req, res) => {
  const results = await Order.aggregate([
    { $match: { status: 'PAYMENT_APPROVED' } },
    { $unwind: '$items' },
    { $group: { _id: '$items.stallId', stallName: { $first: '$items.stallName' }, quantitySold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } },
    { $sort: { quantitySold: -1, revenue: -1 } },
  ]);
  const first = results[0] || null;
  const leaders = first ? results.filter((result) => result.quantitySold === first.quantitySold && result.revenue === first.revenue) : [];
  res.json({ stall: first, leaders, isTie: leaders.length > 1 });
};
