import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import env from '../src/config/env.js';
import Food from '../src/models/Food.js';
import FoodItem from '../src/models/FoodItem.js';
import StallFood from '../src/models/StallFood.js';
import Stall from '../src/models/Stall.js';
import User from '../src/models/User.js';
import EventConfig from '../src/models/EventConfig.js';
import stalls from './data/stalls.js';
import foodItems from './data/foodItems.js';
import { findAvailableSlug } from '../src/services/stallService.js';
import { migrateLegacyFoodItems } from '../src/services/foodMigrationService.js';

const assertSafeDatabase = () => {
  if (env.nodeEnv === 'production') throw new Error('Demo seeding is disabled in production');
  const databaseName = new URL(env.mongoUri).pathname.slice(1).split('?')[0];
  if (!databaseName || databaseName === 'admin' || databaseName === 'local' || databaseName === 'config') throw new Error('Refusing to seed an unsafe database target');
};

try {
  assertSafeDatabase();
  await connectDatabase();
  for (const stallData of stalls) await Stall.findOneAndUpdate({ stallName: stallData.stallName }, stallData, { upsert: true, new: true, runValidators: true });
  const savedStalls = await Stall.find({ stallName: { $in: stalls.map((stall) => stall.stallName) } });
  for (const stall of savedStalls) {
    if (!stall.slug) await Stall.collection.updateOne({ _id: stall._id, slug: { $exists: false } }, { $set: { slug: await findAvailableSlug(stall.stallName, stall._id) } });
  }
  const stallIds = new Map(savedStalls.map((stall) => [stall.stallName, stall._id]));
  await migrateLegacyFoodItems();
  const foodIds = new Map();
  for (const definition of foodItems) {
    const foodKey = definition.foodKey || `demo-${definition.stallName}-${definition.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (foodIds.has(foodKey)) continue;
    const legacy = await FoodItem.findOne({ stallId: stallIds.get(definition.stallName), name: definition.name });
    let food = legacy ? await Food.findOne({ legacyFoodItemId: legacy._id }) : null;
    if (food && !food.seedKey) { food.seedKey = foodKey; await food.save(); }
    food ||= await Food.findOneAndUpdate({ seedKey: foodKey }, { $setOnInsert: { seedKey: foodKey, name: definition.name, description: definition.description, image: { url: `/demo/foods/${definition.name.toLowerCase().replaceAll(' ', '-')}.jpg`, storageKey: '', provider: 'demo-local' }, isActive: true } }, { upsert: true, new: true, runValidators: true });
    foodIds.set(foodKey, food._id);
  }
  for (const definition of foodItems) {
    const foodKey = definition.foodKey || `demo-${definition.stallName}-${definition.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const stall = savedStalls.find((candidate) => candidate.stallName === definition.stallName);
    await StallFood.findOneAndUpdate({ stallId: stall._id, foodId: foodIds.get(foodKey) }, { $setOnInsert: { stallId: stall._id, foodId: foodIds.get(foodKey), eventDayPrice: definition.eventDayPrice, discount: definition.discount || stall.discount, ticketLimit: definition.ticketLimit, reservedTickets: 0, soldTickets: 0, isAvailable: definition.isAvailable } }, { upsert: true, new: true, runValidators: true });
  }
  const demoEvent = {
    configKey: 'current', eventName: 'DEMO Fun Fair 2030', eventDate: new Date('2030-02-15T09:00:00+06:30'), eventTimezone: 'Asia/Yangon',
    preorderOpenAt: new Date('2026-01-01T00:00:00+06:30'), preorderCloseAt: new Date('2030-02-14T09:00:00+06:30'), orderingEnabled: true,
    kbzAccountName: 'DEMO FUN FAIR ACCOUNT', kbzAccountNumber: 'DEMO-000000000', paymentInstructions: 'DEMO ONLY: include the order payment reference in the KBZ payment note.',
    orderReservationMinutes: 60, paymentProofGraceMinutes: 30, featureFlags: { memoriesEnabled: false, eventPageEnabled: false, crushLettersEnabled: false },
  };
  await EventConfig.updateOne({ configKey: 'current' }, { $setOnInsert: demoEvent }, { upsert: true, runValidators: true, timestamps: false });
  const adminName = process.env.SEED_ADMIN_NAME?.trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminName && adminPassword) {
    if (adminPassword.length < 8) throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters');
    await User.findOneAndUpdate({ nameNormalized: adminName.toLocaleLowerCase('en-US') }, { name: adminName, nameNormalized: adminName.toLocaleLowerCase('en-US'), passwordHash: await bcrypt.hash(adminPassword, 12), role: 'admin' }, { upsert: true, runValidators: true });
    console.log('Optional demo administrator seeded from environment variables');
  }
  console.log(`Demo seed complete: ${stalls.length} stalls, ${foodIds.size} foods, ${foodItems.length} stall foods, and current event configuration`);
} catch (error) {
  console.error('Demo seed failed:', error.message);
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
