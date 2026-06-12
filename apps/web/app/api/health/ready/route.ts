import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { BUCKET, minioClient } from '@/lib/minio'
import { err, ok, serverError, withNoStore } from '@/lib/api-helpers'
import { getClientIP, rateLimitIP } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  try {
    // Readiness probes hit real dependencies (DB/Redis/MinIO); an IP cap keeps
    // outsiders from using this as a free dependency-probing endpoint while
    // leaving plenty of headroom for orchestrator healthchecks (every 15s).
    const rl = await rateLimitIP(getClientIP(req), 'health_ready', 30, 60)
    if (!rl.allowed) return err('Too many requests', 429)

    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
      minioClient.bucketExists(BUCKET),
    ])

    return withNoStore(ok({ status: 'ready' }))
  } catch (e) {
    return serverError('health/ready', e)
  }
}
