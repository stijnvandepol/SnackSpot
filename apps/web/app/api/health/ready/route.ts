import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { BUCKET, minioClient } from '@/lib/minio'
import { ok, serverError, withNoStore } from '@/lib/api-helpers'

export async function GET() {
  try {
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
      minioClient.bucketExists(BUCKET),
    ])

    return withNoStore(ok({ status: 'ready' }))
  } catch (err) {
    return serverError('health/ready', err)
  }
}
