import dotenv from 'dotenv';

dotenv.config();

export const defaultDevelopmentMongoUri = 'mongodb://127.0.0.1:27017/funfair';
export const defaultTestMongoUri = 'mongodb://127.0.0.1:27017/funfair_test';

export const selectMongoUri = (nodeEnv, source = process.env) => {
  if (nodeEnv === 'production') {
    if (!source.MONGODB_URI_PRODUCTION) throw new Error('MONGODB_URI_PRODUCTION is not configured for NODE_ENV=production');
    return source.MONGODB_URI_PRODUCTION;
  }
  if (nodeEnv === 'development') {
    return source.MONGODB_URI_DEVELOPMENT || defaultDevelopmentMongoUri;
  }
  if (nodeEnv === 'test') {
    return source.MONGODB_URI || defaultTestMongoUri;
  }
  throw new Error(`Unsupported NODE_ENV: ${nodeEnv}`);
};

const nodeEnv = process.env.NODE_ENV || 'development';
const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  mongoUri: selectMongoUri(nodeEnv),
  mongoTarget: nodeEnv === 'production' ? 'production/Atlas' : nodeEnv === 'development' ? 'development/local' : 'test/isolated',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  r2Bucket: process.env.R2_BUCKET,
};

export const assertRuntimeEnv = () => {
  if (!env.jwtSecret) throw new Error('JWT_SECRET is required');
  if (env.nodeEnv === 'production' && env.jwtSecret === 'replace_with_a_secure_secret') {
    throw new Error('JWT_SECRET must be changed in production');
  }
};

export default env;
