import Food from '../models/Food.js';
import FoodItem from '../models/FoodItem.js';
import Order from '../models/Order.js';
import StallFood from '../models/StallFood.js';

export const migrateLegacyFoodItems = async () => {
  const legacyItems = await FoodItem.find().populate('stallId').lean();
  let foodsCreated = 0; let stallFoodsCreated = 0; let orderItemsBackfilled = 0;
  const mapping = new Map();
  for (const item of legacyItems) {
    if (!item.stallId) continue;
    const foodResult = await Food.updateOne({ legacyFoodItemId: item._id }, { $setOnInsert: { name: item.name, description: item.description, image: item.image, isActive: true, legacyFoodItemId: item._id } }, { upsert: true });
    if (foodResult.upsertedCount) foodsCreated += 1;
    const food = await Food.findOne({ legacyFoodItemId: item._id });
    const entryResult = await StallFood.updateOne({ legacyFoodItemId: item._id }, { $setOnInsert: { stallId: item.stallId._id, foodId: food._id, eventDayPrice: item.eventDayPrice, discount: item.stallId.discount || { type: 'percentage', value: 0 }, ticketLimit: item.ticketLimit, reservedTickets: item.reservedTickets || 0, soldTickets: item.soldTickets || 0, isAvailable: item.isAvailable, legacyFoodItemId: item._id } }, { upsert: true });
    if (entryResult.upsertedCount) stallFoodsCreated += 1;
    const entry = await StallFood.findOne({ legacyFoodItemId: item._id });
    mapping.set(String(item._id), { stallFoodId: entry._id, foodId: food._id });
  }
  const orders = await Order.find({ 'items.foodItemId': { $exists: true } });
  for (const order of orders) {
    let changed = false;
    for (const item of order.items) {
      if (item.stallFoodId || !item.foodItemId) continue;
      const mapped = mapping.get(String(item.foodItemId));
      if (!mapped) continue;
      item.stallFoodId = mapped.stallFoodId;
      item.foodId = mapped.foodId;
      orderItemsBackfilled += 1; changed = true;
    }
    if (changed) await order.save();
  }
  return { legacyItems: legacyItems.length, foodsCreated, stallFoodsCreated, orderItemsBackfilled };
};
