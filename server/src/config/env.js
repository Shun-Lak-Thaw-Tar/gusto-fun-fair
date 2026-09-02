import dotenv from 'dotenv';

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/funfair',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};

export const assertRuntimeEnv = () => {
  if (!env.jwtSecret) throw new Error('JWT_SECRET is required');
  if (env.nodeEnv === 'production' && env.jwtSecret === 'replace_with_a_secure_secret') {
    throw new Error('JWT_SECRET must be changed in production');
  }
};

export default env;
