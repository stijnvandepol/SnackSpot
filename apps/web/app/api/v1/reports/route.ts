import { type NextRequest } from 'next/server'
import { CreateReportSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { created, err, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const rl = await rateLimitUser(auth.sub, 'report_create', 10, 3600)
  if (!rl.allowed) return err('Report rate limit exceeded', 429)

  const body = await parseBody(req, CreateReportSchema)
  if (isResponse(body)) return body

  if (body.targetType === 'REVIEW' && !body.reviewId) return err('reviewId required for REVIEW reports', 422)
  if (body.targetType === 'PHOTO' && !body.photoId) return err('photoId required for PHOTO reports', 422)

  try {
    const report = await prisma.report.create({
      data: {
        reporterId: auth.sub,
        targetType: body.targetType,
        reviewId: body.reviewId,
        photoId: body.photoId,
        reason: body.reason,
      },
      select: { id: true, targetType: true, status: true, createdAt: true },
    })
    return created(report)
  } catch (e) {
    return serverError('reports POST', e)
  }
}
