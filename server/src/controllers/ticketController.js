import Ticket from '../models/Ticket.js';
import Redemption from '../models/Redemption.js';
import ApiError from '../utils/ApiError.js';

export const listMyTickets = async (req, res) => res.json({ tickets: await Ticket.find({ userId: req.user._id }).populate('orderId') });
export const lookupTicket = async (req, res) => {
  const ticket = await Ticket.findOne({ code: req.params.code.toUpperCase() }).populate('orderId').populate('userId', 'name role');
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  res.json({ ticket });
};
export const redeemTicket = async (req, res) => {
  const eligible = await Ticket.findOne({ code: req.params.code.toUpperCase(), status: 'ACTIVE' }).populate('orderId');
  if (!eligible) throw new ApiError(409, 'Ticket is invalid or has already been redeemed');
  if (!eligible.orderId || eligible.orderId.status !== 'PAYMENT_APPROVED') throw new ApiError(409, 'Only tickets for approved orders can be redeemed');
  // Conditional update is atomic: only one request can move ACTIVE to REDEEMED.
  const ticket = await Ticket.findOneAndUpdate({ _id: eligible._id, status: 'ACTIVE' }, { status: 'REDEEMED', redeemedAt: new Date(), redeemedBy: req.user._id }, { new: true }).populate('orderId');
  if (!ticket) throw new ApiError(409, 'Ticket is invalid or has already been redeemed');
  const redemption = await Redemption.create({ ticketId: ticket._id, orderId: ticket.orderId, userId: ticket.userId, redeemedBy: req.user._id, redeemedAt: ticket.redeemedAt });
  res.json({ ticket, redemption });
};
