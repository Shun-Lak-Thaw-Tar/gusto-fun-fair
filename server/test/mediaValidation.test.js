import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { validateImage } from '../src/services/mediaService.js';
import { MAX_IMAGE_BYTES } from '../src/middleware/uploadMiddleware.js';
import { windowStatus } from '../src/services/memoryService.js';

test('image validation decodes accepted formats and strips metadata', async () => {
  for (const format of ['jpeg', 'png', 'webp']) {
    const buffer = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).withMetadata().toFormat(format).toBuffer();
    const result = await validateImage({ buffer, mimetype: `image/${format}` });
    assert.equal(result.contentType, `image/${format}`);
    const metadata = await sharp(result.buffer).metadata();
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.width, 10);
  }
});
test('rejects disguised, corrupt, oversized and unsupported images', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
  await assert.rejects(validateImage({ buffer: png, mimetype: 'image/jpeg' }), { statusCode: 400 });
  await assert.rejects(validateImage({ buffer: Buffer.from('<svg></svg>'), mimetype: 'image/png' }), { statusCode: 400 });
  await assert.rejects(validateImage({ buffer: png.subarray(0, 40), mimetype: 'image/png' }), { statusCode: 400 });
  await assert.rejects(validateImage({ buffer: Buffer.alloc(MAX_IMAGE_BYTES + 1), mimetype: 'image/png' }), { statusCode: 413 });
  await assert.rejects(validateImage(), { statusCode: 400 });
});
test('snap window includes opening and excludes closing, across Myanmar offset', () => {
  const settings = { opensAt: new Date('2030-01-01T09:00:00+06:30'), closesAt: new Date('2030-01-01T18:00:00+06:30') };
  assert.equal(windowStatus(null), 'NOT_CONFIGURED');
  assert.equal(windowStatus(settings, new Date('2030-01-01T02:29:59Z')), 'UPCOMING');
  assert.equal(windowStatus(settings, new Date('2030-01-01T02:30:00Z')), 'OPEN');
  assert.equal(windowStatus(settings, new Date('2030-01-01T11:30:00Z')), 'CLOSED');
});
