import mongoose from 'mongoose';
import env from './env.js';

export const connectDatabase = async () => mongoose.connect(env.mongoUri);
export const disconnectDatabase = async () => mongoose.disconnect();
