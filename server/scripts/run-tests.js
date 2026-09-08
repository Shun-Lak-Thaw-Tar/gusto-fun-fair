import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const serverRoot = fileURLToPath(new URL('../', import.meta.url));
let replica;
try {
  replica = await MongoMemoryReplSet.create({ binary: { downloadDir: resolve(serverRoot, '.mongodb-binaries') }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  console.log('Tests use an isolated temporary MongoDB replica set.');
  const child = spawn(process.execPath, ['--test'], { cwd: serverRoot, stdio: 'inherit', env: { ...process.env, TEST_MONGODB_URI: replica.getUri(), NODE_ENV: 'test' } });
  process.exitCode = await new Promise((resolveExit, reject) => { child.once('error', reject); child.once('exit', code => resolveExit(code ?? 1)); });
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { if (replica) await replica.stop(); }
