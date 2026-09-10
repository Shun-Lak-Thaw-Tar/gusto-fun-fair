import mongoose from "mongoose";
import CrushLetter from "../models/CrushLetter.js";
import ApiError from "../utils/ApiError.js";
import {
  consumePreorderPrivilege,
  hasConsumedPrivilege,
} from "./preorderPrivilegeService.js";

const PRIVILEGE = "CRUSH_LETTER";

export const crushLetterAllowance = async (userId, eventId, session) => {
  const consumed = await hasConsumedPrivilege({
    userId,
    eventId,
    privilege: PRIVILEGE,
    session,
  });
  return consumed ? 3 : 1;
};

export const crushLetterContext = async (userId, eventId) => {
  const [allowance, used] = await Promise.all([
    crushLetterAllowance(userId, eventId),
    CrushLetter.countDocuments({ eventId, authorUserId: userId }),
  ]);
  return { allowance, used, remaining: Math.max(0, allowance - used) };
};

export const createCrushLetter = async ({
  userId,
  eventId,
  recipientName,
  message,
  privilegeCode,
}) => {
  try {
    return await mongoose.connection.transaction(async (session) => {
      const used = await CrushLetter.countDocuments({
        eventId,
        authorUserId: userId,
      }).session(session);
      const slot = used + 1;
      let consumed = await hasConsumedPrivilege({
        userId,
        eventId,
        privilege: PRIVILEGE,
        session,
      });
      if (slot > 1 && !consumed) {
        if (!privilegeCode)
          throw new ApiError(
            409,
            "A valid eligible pre-order code is required for additional letters",
          );
        await consumePreorderPrivilege({
          userId,
          eventId,
          code: privilegeCode,
          privilege: PRIVILEGE,
          session,
        });
        consumed = true;
      }
      const allowance = consumed ? 3 : 1;
      if (slot > allowance)
        throw new ApiError(409, "Your letter allowance for this event is used");
      const [letter] = await CrushLetter.create(
        [{ authorUserId: userId, eventId, recipientName, message, isAnonymous: true }],
        { session },
      );
      return letter;
    });
  } catch (error) {
    if (error.code === 11000)
      throw new ApiError(
        409,
        "This pre-order code has already been used for this privilege",
      );
    throw error;
  }
};
