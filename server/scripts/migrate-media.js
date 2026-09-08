import mongoose from 'mongoose';
import env from '../src/config/env.js';
import Order from '../src/models/Order.js';
import Memory from '../src/models/Memory.js';
import { getCurrentEvent } from '../src/services/eventService.js';

// Existing V1 orders belonged to the only current event. Never infer another event.
try {
  await mongoose.connect(env.mongoUri);
  const event = await getCurrentEvent();
  const filter = { eventId: { $exists: false } };
  const legacyOrders = await Order.countDocuments(filter);
  const legacyMemories = await Memory.collection.countDocuments(filter);
  console.log({ eventId: String(event._id), eventName: event.eventName, legacyOrders, legacyMemories, apply: process.argv.includes('--apply') });
  if (legacyMemories) throw new Error('Legacy URL-only memories need manual R2 import and slot assignment before this migration. No records were changed.');
  if (process.argv.includes('--apply')) console.log(await Order.updateMany(filter, { $set: { eventId: event._id } }));
  else console.log('Dry run only. Confirm all legacy orders belong to the current event, then rerun with -- --apply.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
