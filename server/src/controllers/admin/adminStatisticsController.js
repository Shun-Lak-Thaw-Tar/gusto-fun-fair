import Order from '../../models/Order.js';

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
