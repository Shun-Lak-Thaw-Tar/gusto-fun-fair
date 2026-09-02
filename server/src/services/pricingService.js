import ApiError from '../utils/ApiError.js';

export const calculatePreorderPrice = (eventDayPrice, discount) => {
  if (!Number.isFinite(eventDayPrice) || eventDayPrice < 0) throw new ApiError(400, 'Invalid event-day price');
  if (!discount || !['percentage', 'fixed'].includes(discount.type) || !Number.isFinite(discount.value) || discount.value < 0) {
    throw new ApiError(400, 'Invalid discount');
  }
  const reduction = discount.type === 'percentage' ? eventDayPrice * discount.value / 100 : discount.value;
  return Math.max(0, Math.round(eventDayPrice - reduction));
};

export const priceOrderItems = (requestedItems, foodItems) => {
  const foodsById = new Map(foodItems.map((food) => [String(food._id), food]));
  return requestedItems.map(({ foodItemId, quantity }) => {
    const food = foodsById.get(String(foodItemId));
    if (!food || !food.stallId || !food.isAvailable || !food.stallId.isActive) throw new ApiError(400, `Food item ${foodItemId} is unavailable`);
    if (!Number.isInteger(quantity) || quantity < 1) throw new ApiError(400, 'Quantity must be a positive integer');
    const unitPrice = calculatePreorderPrice(food.eventDayPrice, food.stallId.discount);
    return { stallId: food.stallId._id, foodItemId: food._id, stallName: food.stallId.stallName, foodName: food.name, quantity, unitPrice, subtotal: unitPrice * quantity };
  });
};
