import * as Minio from 'minio'
import { env } from './env'
import { logger } from './logger'

export const minioClient = new Minio.Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
})

export const BUCKET = env.MINIO_BUCKET

let _bucketInit: Promise<void> | null = null

/** Ensure the bucket and policy exist; memoized per process. */
export async function ensureBucket(): Promise<void> {
  if (!_bucketInit) {
    _bucketInit = ensureBucketInternal().catch((err) => {
      _bucketInit = null
      throw err
    })
  }
  return _bucketInit
}

async function ensureBucketInternal(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET)
  if (!exists) {
    await minioClient.makeBucket(BUCKET, 'us-east-1')
    logger.info({ bucket: BUCKET }, 'MinIO bucket created')
  }

  // Set anonymous read policy for variants/* prefix only
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/variants/*`],
      },
    ],
  })
  await minioClient.setBucketPolicy(BUCKET, policy)
}

/** Generate a presigned PUT URL for direct browser upload */
export async function presignedPut(key: string, expirySeconds = 300): Promise<string> {
  // Generate presigned URL against the internal MinIO endpoint
  const internalUrl = await minioClient.presignedPutObject(BUCKET, key, expirySeconds)

  // Replace the internal host with the public URL so the browser can reach it
  const publicBase = env.MINIO_PUBLIC_URL
  const internalBase = `http${env.MINIO_USE_SSL ? 's' : ''}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`
  return internalUrl.replace(internalBase, publicBase)
}

export interface ObjectInfo {
  size: number
  contentType: string | null
}

/** Read object metadata. Returns null when object does not exist. */
export async function getObjectInfo(key: string): Promise<ObjectInfo | null> {
  try {
    const stat = await minioClient.statObject(BUCKET, key)
    const contentType =
      stat.metaData?.['content-type'] ??
      stat.metaData?.['Content-Type'] ??
      null
    return {
      size: stat.size,
      contentType: typeof contentType === 'string' ? contentType : null,
    }
  } catch {
    return null
  }
}

/** Build the public URL for a stored variant */
export function variantUrl(key: string): string {
  return `${env.MINIO_PUBLIC_URL}/${BUCKET}/${key}`
}
