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

/** Ensure the bucket exists (called on first upload) */
export async function ensureBucket(): Promise<void> {
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

  logger.debug({ internalUrl, internalBase, publicBase }, 'Presigned PUT URL before replacement')
  
  const finalUrl = internalUrl.replace(internalBase, publicBase)
  
  logger.debug({ finalUrl }, 'Presigned PUT URL after replacement')

  return finalUrl
}

/** Check if an object exists in the bucket */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await minioClient.statObject(BUCKET, key)
    return true
  } catch {
    return false
  }
}

/** Build the public URL for a stored variant */
export function variantUrl(key: string): string {
  return `${env.MINIO_PUBLIC_URL}/${BUCKET}/${key}`
}
