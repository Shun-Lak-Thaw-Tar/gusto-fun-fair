import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

export const requireAuth = async (req, _res, next) => {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Authentication required');
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'Authentication required');
    if (user.isActive === false) throw new ApiError(403, 'Account is disabled');
    req.user = user;
    next();
  } catch (error) { next(error instanceof ApiError ? error : new ApiError(401, 'Invalid or expired token')); }
};
