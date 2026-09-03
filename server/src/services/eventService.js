import EventConfig from '../models/EventConfig.js';
import ApiError from '../utils/ApiError.js';

export const derivePreorderStatus = (config, now = new Date()) => {
  if (!config.orderingEnabled) return 'DISABLED';
  if (config.preorderOpenAt && now < config.preorderOpenAt) return 'UPCOMING';
  if (now >= config.preorderCloseAt) return 'CLOSED';
  return 'OPEN';
};

export const getCurrentEvent = async () => {
  const config = await EventConfig.findOne({ configKey: 'current' });
  if (!config) throw new ApiError(503, 'Current event configuration is unavailable');
  return config;
};

export const assertOrderingOpen = (config, now = new Date()) => {
  const status = derivePreorderStatus(config, now);
  if (status !== 'OPEN') throw new ApiError(409, `Pre-ordering is ${status.toLowerCase()}`);
};

export const presentEvent = (config, now = new Date(), includePayment = false) => ({
  eventName: config.eventName,
  eventDate: config.eventDate,
  eventTimezone: config.eventTimezone,
  preorderOpenAt: config.preorderOpenAt,
  preorderCloseAt: config.preorderCloseAt,
  orderingEnabled: config.orderingEnabled,
  preorderStatus: derivePreorderStatus(config, now),
  featureFlags: {
    memoriesEnabled: config.featureFlags?.memoriesEnabled ?? false,
    eventPageEnabled: config.featureFlags?.eventPageEnabled ?? false,
  },
  orderReservationMinutes: config.orderReservationMinutes,
  paymentProofGraceMinutes: config.paymentProofGraceMinutes,
  ...(includePayment ? { kbzAccountName: config.kbzAccountName, kbzAccountNumber: config.kbzAccountNumber, paymentInstructions: config.paymentInstructions } : {}),
});
