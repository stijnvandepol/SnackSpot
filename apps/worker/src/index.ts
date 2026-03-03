import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Redis } from 'ioredis';
import pg from 'pg';
import sharp from 'sharp';

const required = ['DATABASE_URL', 'REDIS_URL', 'S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'] as const;
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

const redis = new Redis(process.env.REDIS_URL!);
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT!,
  region: process.env.S3_REGION!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!
  }
});

const bucket = process.env.S3_BUCKET!;

type UploadJob = {
  photoId: string;
  originalKey: string;
};

async function streamToBuffer(stream: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function processPhoto(job: UploadJob) {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: job.originalKey }));
  const input = await streamToBuffer(object.Body);

  const image = sharp(input, { failOn: 'warning' }).rotate();
  const metadata = await image.metadata();

  const thumb = await image.clone().resize({ width: 256, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const medium = await image.clone().resize({ width: 1024, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const large = await image.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();

  const thumbKey = job.originalKey.replace('uploads/', 'processed/thumb/').replace(/\.(png|jpg|jpeg|webp)$/i, '.webp');
  const mediumKey = job.originalKey.replace('uploads/', 'processed/medium/').replace(/\.(png|jpg|jpeg|webp)$/i, '.webp');
  const largeKey = job.originalKey.replace('uploads/', 'processed/large/').replace(/\.(png|jpg|jpeg|webp)$/i, '.webp');

  await Promise.all([
    s3.send(new PutObjectCommand({ Bucket: bucket, Key: thumbKey, Body: thumb, ContentType: 'image/webp', CacheControl: 'public,max-age=31536000,immutable' })),
    s3.send(new PutObjectCommand({ Bucket: bucket, Key: mediumKey, Body: medium, ContentType: 'image/webp', CacheControl: 'public,max-age=31536000,immutable' })),
    s3.send(new PutObjectCommand({ Bucket: bucket, Key: largeKey, Body: large, ContentType: 'image/webp', CacheControl: 'public,max-age=31536000,immutable' }))
  ]);

  await pool.query(
    `UPDATE photos
     SET storage_key_thumb = $2,
         storage_key_medium = $3,
         storage_key_large = $4,
         width = $5,
         height = $6,
         moderation_status = 'approved'
     WHERE id = $1`,
    [job.photoId, thumbKey, mediumKey, largeKey, metadata.width ?? 1, metadata.height ?? 1]
  );
}

async function start() {
  console.log('Worker started, listening to queue photo:process');
  while (true) {
    const result = await redis.brpop('photo:process', 0);
    if (!result) continue;

    const payload = result[1];
    try {
      const job = JSON.parse(payload) as UploadJob;
      await processPhoto(job);
      console.log(`Processed photo ${job.photoId}`);
    } catch (error) {
      console.error('Failed processing photo job', error);
    }
  }
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
