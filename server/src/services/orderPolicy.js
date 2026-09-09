// Existing event settings may still contain the old 60-minute value.
export const reservationMinutes = config => Math.min(config.orderReservationMinutes || 30, 30);
export const maxOrderQuantity = remaining => remaining <= 0 ? 0 : remaining > 5 ? 2 : 1;
