import Ticket from '../models/Ticket.js';
import generateTicketCode from '../utils/generateTicketCode.js';

export const createTicketForOrder = async (order, session) => {
  const existing = await Ticket.findOne({ orderId: order._id }).session(session || null);
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [ticket] = await Ticket.create([{ orderId: order._id, userId: order.userId, code: generateTicketCode() }], session ? { session } : {});
      return ticket;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new Error('Unable to generate a unique ticket code');
};
