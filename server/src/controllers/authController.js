import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import env from '../config/env.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

const credentialsSchema = z.object({ name: z.string().trim().min(2).max(50), password: z.string().min(8).max(128) });
const normalizeName = (name) => name.trim().replace(/\s+/g, ' ');
const loginKey = (name) => normalizeName(name).toLocaleLowerCase('en-US');
const tokenFor = (user) => jwt.sign({ role: user.role }, env.jwtSecret, { subject: String(user._id), expiresIn: env.jwtExpiresIn });

export const register = async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid registration data', z.treeifyError(parsed.error));
  const name = normalizeName(parsed.data.name);
  const user = await User.create({ name, nameNormalized: loginKey(name), passwordHash: await bcrypt.hash(parsed.data.password, 12), role: 'user' });
  res.status(201).json({ user, token: tokenFor(user) });
};
export const login = async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid login data');
  const name = normalizeName(parsed.data.name);
  const user = await User.findOne({ nameNormalized: loginKey(name) }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) throw new ApiError(401, 'Invalid name or password');
  if (user.isActive === false) throw new ApiError(403, 'Account is disabled');
  user.passwordHash = undefined;
  res.json({ user, token: tokenFor(user) });
};
export const me = async (req, res) => res.json({ user: req.user });
