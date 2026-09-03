import Order, { ORDER_STATUSES } from '../../models/Order.js';
import Payment from '../../models/Payment.js';
import Ticket from '../../models/Ticket.js';
import ApiError from '../../utils/ApiError.js';

export const listOrders = async (req, res) => {
  const filter = {};
  if (req.query.status) {
    if (!ORDER_STATUSES.includes(req.query.status)) throw new ApiError(400, 'Invalid order status filter');
    filter.status = req.query.status;
  }
  const orders = await Order.find(filter).populate('userId', 'name role isActive').sort({ createdAt: -1 }).lean();
  res.json({ orders });
};

export const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('userId', 'name role isActive').lean();
  if (!order) throw new ApiError(404, 'Order not found');
  const [payment, ticket] = await Promise.all([Payment.findOne({ orderId: order._id }).lean(), Ticket.findOne({ orderId: order._id }).lean()]);
  res.json({ order, payment, ticket });
};
