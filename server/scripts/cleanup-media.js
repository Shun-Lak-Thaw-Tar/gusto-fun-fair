import '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { cleanupMedia } from '../src/services/mediaService.js';
try { await connectDatabase(); console.log(await cleanupMedia()); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await disconnectDatabase(); }
