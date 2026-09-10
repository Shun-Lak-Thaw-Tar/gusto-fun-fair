import Order from "../models/Order.js";
import PreorderPrivilegeUse from "../models/PreorderPrivilegeUse.js";
import ApiError from "../utils/ApiError.js";

// Privilege codes are shareable: the code just has to belong to some approved order for
// this event, not one the redeemer placed themselves — e.g. a friend's order code is valid.
export const findEligibleOrder = async ({ eventId, code, session }) => {
  const order = await Order.findOne({
    preorderPrivilegeCode: code,
    eventId,
    status: "PAYMENT_APPROVED",
  }).session(session || null);
  if (!order) throw new ApiError(409, "Invalid or ineligible pre-order code");
  return order;
};

export const consumePreorderPrivilege = async ({
  userId,
  eventId,
  code,
  privilege,
  session,
}) => {
  const order = await findEligibleOrder({ userId, eventId, code, session });
  try {
    await PreorderPrivilegeUse.create(
      [{ userId, orderId: order._id, eventId, privilege }],
      { session },
    );
  } catch (error) {
    if (error.code === 11000)
      throw new ApiError(
        409,
        "This pre-order code has already been used for this privilege",
      );
    throw error;
  }
  return order;
};

export const hasConsumedPrivilege = ({ userId, eventId, privilege, session }) =>
  PreorderPrivilegeUse.exists({ userId, eventId, privilege }).session(
    session || null,
  );
