import EventConfig from "../models/EventConfig.js";
import ApiError from "../utils/ApiError.js";

export const derivePreorderStatus = (config, now = new Date()) => {
  if (!config.orderingEnabled) return "DISABLED";
  if (config.preorderOpenAt && now < config.preorderOpenAt) return "UPCOMING";
  if (now >= config.preorderCloseAt) return "CLOSED";
  return "OPEN";
};

export const getCurrentEvent = async () => {
  const config = await EventConfig.findOne({ configKey: "current" });
  if (!config)
    throw new ApiError(503, "Current event configuration is unavailable");
  return config;
};

export const assertOrderingOpen = (config, now = new Date()) => {
  const status = derivePreorderStatus(config, now);
  if (status !== "OPEN")
    throw new ApiError(409, `Pre-ordering is ${status.toLowerCase()}`);
};

export const isEventActive = (config, now = new Date()) => {
  const timeZone = config.eventTimezone || "Asia/Yangon";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const today = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const eventParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(config.eventDate);
  const eventDay = Object.fromEntries(
    eventParts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return (
    today.year === eventDay.year &&
    today.month === eventDay.month &&
    today.day === eventDay.day
  );
};

export const assertEventActive = (config, now = new Date()) => {
  if (!isEventActive(config, now))
    throw new ApiError(409, "This feature is available only on the event day");
};

export const assertQuizEnabled = (config) => {
  if (!config.featureFlags?.quizEnabled)
    throw new ApiError(409, "The Quiz feature is currently disabled");
};

export const presentEvent = (
  config,
  now = new Date(),
  includePayment = false,
) => ({
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
    crushLettersEnabled: config.featureFlags?.crushLettersEnabled ?? false,
    quizEnabled: config.featureFlags?.quizEnabled ?? false,
  },
  orderReservationMinutes: config.orderReservationMinutes,
  paymentProofGraceMinutes: config.paymentProofGraceMinutes,
  ...(includePayment
    ? {
        kbzAccountName: config.kbzAccountName,
        kbzAccountNumber: config.kbzAccountNumber,
        paymentInstructions: config.paymentInstructions,
      }
    : {}),
});
