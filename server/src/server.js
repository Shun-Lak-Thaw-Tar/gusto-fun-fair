import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import env, { assertRuntimeEnv } from './config/env.js';

let server;
const shutdown = async (signal) => {
  console.log(`${signal} received; shutting down`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
  process.exit(0);
};

try {
  assertRuntimeEnv();
  await connectDatabase();
  console.log(`MongoDB connected (${env.mongoTarget})`);
  server = app.listen(env.port, () => console.log(`Fun Fair API listening on port ${env.port}`));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
} catch (error) {
  console.error('Server startup failed:', error.message);
  process.exit(1);
}
