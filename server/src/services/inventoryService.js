import StallFood from '../models/StallFood.js';
import { maxOrderQuantity } from './orderPolicy.js';
import ApiError from '../utils/ApiError.js';

export const ticketsRemaining = (food) => Math.max(0, food.ticketLimit - (food.reservedTickets || 0) - (food.soldTickets || 0));

const entryId = (item) => item.stallFoodId;
const reserveOne = (stallFoodId, quantity) => StallFood.updateOne({
  _id: stallFoodId,
  isAvailable: true,
  $expr: { $lte: [{ $add: [{ $ifNull: ['$reservedTickets', 0] }, { $ifNull: ['$soldTickets', 0] }, quantity] }, '$ticketLimit'] },
}, { $inc: { reservedTickets: quantity } });

export const reserveInventory = async (items) => {
  const reserved = [];
  try {
    for (const item of [...items].sort((a, b) => String(entryId(a)).localeCompare(String(entryId(b))))) {
      const result = await reserveOne(entryId(item), item.quantity);
      if (result.modifiedCount !== 1) throw new ApiError(409, `${item.foodName || 'Food item'} has insufficient remaining tickets`);
      reserved.push(item);
    }
  } catch (error) {
    await Promise.all(reserved.map((item) => StallFood.updateOne({ _id: entryId(item), reservedTickets: { $gte: item.quantity } }, { $inc: { reservedTickets: -item.quantity } })));
    throw error;
  }
};

export const releaseInventory = async (items) => {
  const released = [];
  try {
    for (const item of items) {
      const result = await StallFood.updateOne({ _id: entryId(item), reservedTickets: { $gte: item.quantity } }, { $inc: { reservedTickets: -item.quantity } });
      if (result.modifiedCount !== 1) throw new Error(`Inventory release invariant failed for ${entryId(item)}`);
      released.push(item);
    }
  } catch (error) {
    await Promise.all(released.map((item) => StallFood.updateOne({ _id: entryId(item) }, { $inc: { reservedTickets: item.quantity } })));
    throw error;
  }
};

export const convertReservedToSold = async (items) => {
  const converted = [];
  try {
    for (const item of items) {
      const result = await StallFood.updateOne({ _id: entryId(item), reservedTickets: { $gte: item.quantity } }, { $inc: { reservedTickets: -item.quantity, soldTickets: item.quantity } });
      if (result.modifiedCount !== 1) throw new Error(`Inventory sale invariant failed for ${entryId(item)}`);
      converted.push(item);
    }
  } catch (error) {
    await Promise.all(converted.map((item) => StallFood.updateOne({ _id: entryId(item), soldTickets: { $gte: item.quantity } }, { $inc: { reservedTickets: item.quantity, soldTickets: -item.quantity } })));
    throw error;
  }
};

export const revertSoldToReserved = async (items) => Promise.all(items.map((item) => StallFood.updateOne(
  { _id: entryId(item), soldTickets: { $gte: item.quantity } },
  { $inc: { reservedTickets: item.quantity, soldTickets: -item.quantity } },
)));

// Payment review settles all foods inside the caller's MongoDB transaction.
export const settleReservedInventory = async (items, approved, session) => {
  if (!session) throw new Error('Payment settlement requires a database transaction');
  for (const item of items) {
    const result = await StallFood.updateOne(
      { _id: entryId(item), reservedTickets: { $gte: item.quantity } },
      { $inc: { reservedTickets: -item.quantity, ...(approved ? { soldTickets: item.quantity } : {}) } },
      { session },
    );
    if (result.modifiedCount !== 1) throw new ApiError(409, 'Reserved inventory changed; payment review could not complete');
  }
};

// The order, user lock and every stock update commit or roll back together.
export const reserveOrderInventory = async (items, session) => {
  if (!session) throw new Error('Order reservation requires a database transaction');
  for (const item of [...items].sort((a, b) => String(a.stallFoodId).localeCompare(String(b.stallFoodId)))) {
    const food = await StallFood.findById(item.stallFoodId).session(session);
    const remaining = food ? ticketsRemaining(food) : 0;
    const maxQuantity = maxOrderQuantity(remaining);
    if (!food?.isAvailable || !remaining) throw new ApiError(409, `${item.foodName} just sold out. Please remove it from your cart.`, { code: 'ORDER_QUANTITY_LIMIT', stallFoodId: String(item.stallFoodId), maxQuantity: 0, ticketsRemaining: 0 });
    if (item.quantity > maxQuantity) throw new ApiError(409, `${item.foodName}: please choose up to ${maxQuantity} per order${remaining <= 5 ? ' while stock is low' : ''}, so everyone gets a chance.`, { code: 'ORDER_QUANTITY_LIMIT', stallFoodId: String(item.stallFoodId), maxQuantity, ticketsRemaining: remaining });
    const result = await StallFood.updateOne({ _id: food._id, reservedTickets: food.reservedTickets, soldTickets: food.soldTickets }, { $inc: { reservedTickets: item.quantity } }, { session });
    if (result.modifiedCount !== 1) throw new ApiError(409, 'Availability changed. Please refresh your cart and try again.');
  }
};
