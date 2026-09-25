import { type NextRequest } from 'next/server'
import { CreateReportSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import { created, err, ok, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { rateLimitUser } from '@/lib/rate-limit'
import { recordEvent } from '@/lib/analytics-store'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const rl = await rateLimitUser(auth.sub, 'report_create', 10, 3600)
  if (!rl.allowed) return err('Report rate limit exceeded', 429)

  const body = await parseBody(req, CreateReportSchema)
  if (isResponse(body)) return body

  if (body.targetType === 'REVIEW' && !body.reviewId) return err('reviewId required for REVIEW reports', 422)
  if (body.targetType === 'PHOTO' && !body.photoId) return err('photoId required for PHOTO reports', 422)
  if (body.targetType === 'PLACE' && !body.placeId) return err('placeId required for PLACE reports', 422)

  // Only the id that matches the target type is stored, so a report can never point at
  // two things at once.
  const target = {
    reviewId: body.targetType === 'REVIEW' ? body.reviewId : undefined,
    photoId: body.targetType === 'PHOTO' ? body.photoId : undefined,
    placeId: body.targetType === 'PLACE' ? body.placeId : undefined,
  }

  try {
    // An unknown id used to surface as a foreign-key 500; answer it as what it is.
    const exists =
      body.targetType === 'REVIEW'
        ? await prisma.review.count({ where: { id: target.reviewId } })
        : body.targetType === 'PHOTO'
          ? await prisma.photo.count({ where: { id: target.photoId } })
          : await prisma.place.count({ where: { id: target.placeId } })
    if (exists === 0) return err('Report target not found', 404)

    // One open report per person per target: repeat clicks should not inflate the queue.
    const duplicate = await prisma.report.findFirst({
      where: { reporterId: auth.sub, targetType: body.targetType, status: 'OPEN', ...target },
      select: { id: true, targetType: true, status: true, createdAt: true },
    })
    if (duplicate) return ok(duplicate)

    const report = await prisma.report.create({
      data: {
        reporterId: auth.sub,
        targetType: body.targetType,
        ...target,
        reason: body.reason,
      },
      select: { id: true, targetType: true, status: true, createdAt: true },
    })
    await recordEvent('report_submitted', body.targetType.toLowerCase())
    return created(report)
  } catch (e) {
    return serverError('reports POST', e)
  }
}
