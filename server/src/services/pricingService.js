import ApiError from '../utils/ApiError.js';

export const calculatePreorderPrice = (eventDayPrice, discount) => {
  if (!Number.isFinite(eventDayPrice) || eventDayPrice < 0) throw new ApiError(400, 'Invalid event-day price');
  if (!discount || !['percentage', 'fixed'].includes(discount.type) || !Number.isFinite(discount.value) || discount.value < 0) {
    throw new ApiError(400, 'Invalid discount');
  }
  const reduction = discount.type === 'percentage' ? eventDayPrice * discount.value / 100 : discount.value;
  return Math.max(0, Math.round(eventDayPrice - reduction));
};

export const priceOrderItems = (requestedItems, stallFoods) => {
  const foodsById = new Map(stallFoods.map((entry) => [String(entry._id), entry]));
  return requestedItems.map(({ stallFoodId, quantity }) => {
    const entry = foodsById.get(String(stallFoodId));
    if (!entry || !entry.stallId || !entry.foodId || !entry.isAvailable || !entry.stallId.isActive || !entry.foodId.isActive) throw new ApiError(400, `Stall food ${stallFoodId} is unavailable`);
    if (!Number.isInteger(quantity) || quantity < 1) throw new ApiError(400, 'Quantity must be a positive integer');
    const unitPrice = calculatePreorderPrice(entry.eventDayPrice, entry.discount);
    return { stallFoodId: entry._id, foodId: entry.foodId._id, stallId: entry.stallId._id, stallName: entry.stallId.stallName, foodName: entry.foodId.name, quantity, unitPrice, subtotal: unitPrice * quantity };
  });
};
