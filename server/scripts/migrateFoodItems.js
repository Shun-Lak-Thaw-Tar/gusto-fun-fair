import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import env from '../src/config/env.js';
import { migrateLegacyFoodItems } from '../src/services/foodMigrationService.js';

if (env.nodeEnv === 'production' && process.env.ALLOW_FOOD_MIGRATION !== 'true') throw new Error('Set ALLOW_FOOD_MIGRATION=true to run the food migration in production');
try {
  await connectDatabase();
  console.log('Food migration complete:', await migrateLegacyFoodItems());
} finally { await disconnectDatabase(); }
