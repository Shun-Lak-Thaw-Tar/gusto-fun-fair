import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,openSync,closeSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const clientRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=resolve(clientRoot,'..');
const serverRoot=resolve(root,'server');
const require=createRequire(resolve(serverRoot,'package.json'));
const mongoose=require('mongoose');
const directory=resolve(root,'data/monitor-local');
mkdirSync(directory,{recursive:true});
const configurationPath=resolve(directory,'configuration.json');
let configuration;
if(existsSync(configurationPath)) configuration=JSON.parse(readFileSync(configurationPath,'utf8'));
else {
 configuration={jwtSecret:randomBytes(48).toString('hex'),adminName:'Monitor Admin',adminPassword:randomBytes(18).toString('base64url')};
 writeFileSync(configurationPath,JSON.stringify(configuration,null,2),{mode:0o600});
 writeFileSync(resolve(directory,'admin-credentials.txt'),`Local development only\nAccount name: ${configuration.adminName}\nPassword: ${configuration.adminPassword}\n`,{mode:0o600});
}
const mongoUri='mongodb://127.0.0.1:27018/funfair_monitor_local?replicaSet=monitor-local';
const runtime={...process.env,NODE_ENV:'development',MONGODB_URI_DEVELOPMENT:mongoUri,JWT_SECRET:configuration.jwtSecret,PORT:'5000',CLIENT_URL:'http://127.0.0.1:5173'};
// An optional user-supplied local file may provide storage credentials only.
if(process.env.MONITOR_MEDIA_ENV_FILE){configuration.mediaEnvFile=resolve(process.env.MONITOR_MEDIA_ENV_FILE);writeFileSync(configurationPath,JSON.stringify(configuration,null,2),{mode:0o600});}
if(configuration.mediaEnvFile){
 const supplied=require('dotenv').parse(readFileSync(configuration.mediaEnvFile));
 for(const key of ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET'])if(supplied[key])runtime[key]=supplied[key];
}
function background(command,args,cwd,env,logName){
 const log=openSync(resolve(directory,logName),'a');
 const child=spawn(command,args,{cwd,env,detached:true,windowsHide:true,stdio:['ignore',log,log]});
 child.on('error',e=>console.error(`Could not start ${logName}: ${e.message}`));child.unref();closeSync(log);return child.pid;
}
async function connection(){return mongoose.createConnection('mongodb://127.0.0.1:27018/funfair_monitor_local?directConnection=true',{serverSelectionTimeoutMS:1200}).asPromise();}
let db;
try{db=await connection();}catch{
 const binary=process.env.MONGOD_PATH||'C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe';
 if(!existsSync(binary))throw new Error('Set MONGOD_PATH to your installed mongod executable.');
 mkdirSync(resolve(directory,'mongo'),{recursive:true});
 background(binary,['--bind_ip','127.0.0.1','--port','27018','--replSet','monitor-local','--dbpath',resolve(directory,'mongo')],root,process.env,'mongo.log');
 for(let i=0;i<20;i++){try{db=await connection();break;}catch{await new Promise(r=>setTimeout(r,500));}}
 if(!db)throw new Error('Local replica set did not start. See data/monitor-local/mongo.log.');
}
try{
 let hello=await db.db.admin().command({hello:1});
 if(!hello.setName){
  if(!hello.isreplicaset)throw new Error('Port 27018 belongs to a standalone database; refusing to reconfigure it.');
  await db.db.admin().command({replSetInitiate:{_id:'monitor-local',members:[{_id:0,host:'127.0.0.1:27018'}]}});
 }
 for(let i=0;i<30;i++){hello=await db.db.admin().command({hello:1});if(hello.isWritablePrimary)break;await new Promise(r=>setTimeout(r,500));}
 if(hello.setName!=='monitor-local'||!hello.isWritablePrimary)throw new Error('Expected writable monitor-local replica set on port 27018.');
 const collections=await db.db.listCollections().toArray();
 if(!collections.length){
  console.log('Seeding the dedicated local demo database through the existing backend seed.');
  const seed=spawn(process.execPath,['seed/seedDemo.js'],{cwd:serverRoot,windowsHide:true,env:{...runtime,SEED_ADMIN_NAME:configuration.adminName,SEED_ADMIN_PASSWORD:configuration.adminPassword},stdio:'inherit'});
  const code=await new Promise((res,rej)=>{seed.on('error',rej);seed.on('exit',res);});
  if(code!==0)throw new Error('Existing demo seed failed.');
 }
}finally{await db.close();}
let backend;
try{backend=await fetch('http://127.0.0.1:5000/api/health',{signal:AbortSignal.timeout(1500)});}catch{}
if(!backend?.ok){const pid=background(process.execPath,['src/server.js'],serverRoot,runtime,'api.log');writeFileSync(resolve(directory,'api-process.json'),JSON.stringify({pid,startedAt:new Date().toISOString()}));}
let ready=false;
for(let i=0;i<120;i++){try{const r=await fetch('http://127.0.0.1:5000/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
if(!ready)throw new Error('Backend did not start. See data/monitor-local/api.log.');
const identity=await fetch('http://127.0.0.1:5000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:configuration.adminName,password:configuration.adminPassword})});
if(!identity.ok)throw new Error('Port 5000 is not accepting the local Monitor administrator. Inspect api.log and the local configuration before continuing.');
let frontend;
try{frontend=await fetch('http://127.0.0.1:5173',{signal:AbortSignal.timeout(1000)});}catch{}
if(!frontend?.ok)background(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],clientRoot,process.env,'frontend.log');
let frontendReady=false;
for(let i=0;i<60;i++){try{const response=await fetch('http://127.0.0.1:5173',{signal:AbortSignal.timeout(1000)});if(response.ok){frontendReady=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
if(!frontendReady)throw new Error('Frontend did not start. See data/monitor-local/frontend.log.');
console.log('Monitor: http://127.0.0.1:5173/admin/login');
console.log('Existing backend: http://127.0.0.1:5000/api/health');
console.log('Local admin credentials: '+resolve(directory,'admin-credentials.txt'));
console.log('Media storage configured: '+(['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET'].every(k=>!!runtime[k])?'yes':'no — provide MONITOR_MEDIA_ENV_FILE for real image storage'));
