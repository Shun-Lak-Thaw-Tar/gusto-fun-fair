import FoodItem from '../models/FoodItem.js';
import ApiError from '../utils/ApiError.js';

export const ticketsRemaining = (food) => Math.max(0, food.ticketLimit - (food.reservedTickets || 0) - (food.soldTickets || 0));

const reserveOne = (foodItemId, quantity) => FoodItem.updateOne({
  _id: foodItemId,
  isAvailable: true,
  $expr: { $lte: [{ $add: [{ $ifNull: ['$reservedTickets', 0] }, { $ifNull: ['$soldTickets', 0] }, quantity] }, '$ticketLimit'] },
}, { $inc: { reservedTickets: quantity } });

export const reserveInventory = async (items) => {
  const reserved = [];
  try {
    for (const item of [...items].sort((a, b) => String(a.foodItemId).localeCompare(String(b.foodItemId)))) {
      const result = await reserveOne(item.foodItemId, item.quantity);
      if (result.modifiedCount !== 1) throw new ApiError(409, `${item.foodName || 'Food item'} has insufficient remaining tickets`);
      reserved.push(item);
    }
  } catch (error) {
    await Promise.all(reserved.map((item) => FoodItem.updateOne({ _id: item.foodItemId, reservedTickets: { $gte: item.quantity } }, { $inc: { reservedTickets: -item.quantity } })));
    throw error;
  }
};

export const releaseInventory = async (items) => {
  const released = [];
  try {
    for (const item of items) {
      const result = await FoodItem.updateOne({ _id: item.foodItemId, reservedTickets: { $gte: item.quantity } }, { $inc: { reservedTickets: -item.quantity } });
      if (result.modifiedCount !== 1) throw new Error(`Inventory release invariant failed for ${item.foodItemId}`);
      released.push(item);
    }
  } catch (error) {
    await Promise.all(released.map((item) => FoodItem.updateOne({ _id: item.foodItemId }, { $inc: { reservedTickets: item.quantity } })));
    throw error;
  }
};

export const convertReservedToSold = async (items) => {
  const converted = [];
  try {
    for (const item of items) {
      const result = await FoodItem.updateOne({ _id: item.foodItemId, reservedTickets: { $gte: item.quantity } }, { $inc: { reservedTickets: -item.quantity, soldTickets: item.quantity } });
      if (result.modifiedCount !== 1) throw new Error(`Inventory sale invariant failed for ${item.foodItemId}`);
      converted.push(item);
    }
  } catch (error) {
    await Promise.all(converted.map((item) => FoodItem.updateOne({ _id: item.foodItemId, soldTickets: { $gte: item.quantity } }, { $inc: { reservedTickets: item.quantity, soldTickets: -item.quantity } })));
    throw error;
  }
};

export const revertSoldToReserved = async (items) => Promise.all(items.map((item) => FoodItem.updateOne(
  { _id: item.foodItemId, soldTickets: { $gte: item.quantity } },
  { $inc: { reservedTickets: item.quantity, soldTickets: -item.quantity } },
)));

// Payment review settles all foods inside the caller's MongoDB transaction.
export const settleReservedInventory = async (items, approved, session) => {
  if (!session) throw new Error('Payment settlement requires a database transaction');
  for (const item of items) {
    const result = await FoodItem.updateOne(
      { _id: item.foodItemId, reservedTickets: { $gte: item.quantity } },
      { $inc: { reservedTickets: -item.quantity, ...(approved ? { soldTickets: item.quantity } : {}) } },
      { session },
    );
    if (result.modifiedCount !== 1) throw new ApiError(409, 'Reserved inventory changed; payment review could not complete');
  }
};
