import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import env from '../src/config/env.js';

if (!env.r2AccountId || !env.r2AccessKeyId || !env.r2SecretAccessKey || !env.r2Bucket) {
  console.error('Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET in server/.env first.');
  process.exitCode = 1;
} else {
  const client = new S3Client({ region: 'auto', endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.r2AccessKeyId, secretAccessKey: env.r2SecretAccessKey } });
  try {
    try { await client.send(new HeadBucketCommand({ Bucket: env.r2Bucket })); console.log('Bucket exists.'); }
    catch (error) {
      if (error.$metadata?.httpStatusCode !== 404) throw error;
      await client.send(new CreateBucketCommand({ Bucket: env.r2Bucket }));
      console.log('Created private media bucket.');
    }
    console.log('Keep r2.dev and custom-domain public access disabled. Use bucket-scoped Object Read & Write credentials for the server.');
  } catch (error) { console.error('R2 setup failed:', error.name, error.$metadata?.httpStatusCode || ''); process.exitCode = 1; }
  finally { client.destroy(); }
}
