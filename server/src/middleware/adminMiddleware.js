import ApiError from '../utils/ApiError.js';

export const requireAdmin = (req, _res, next) => req.user?.role === 'admin' ? next() : next(new ApiError(403, 'Administrator access required'));
