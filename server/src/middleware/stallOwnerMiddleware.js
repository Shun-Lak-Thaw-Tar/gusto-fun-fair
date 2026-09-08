import ApiError from '../utils/ApiError.js';

export const requireStallOwner = (req, _res, next) => {
  if (req.user?.role !== 'stall_owner' || !req.user.stallId) return next(new ApiError(403, 'Stall owner access required'));
  return next();
};
