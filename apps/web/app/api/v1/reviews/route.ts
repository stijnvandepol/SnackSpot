import { type NextRequest } from 'next/server'
import { CreateReviewSchema } from '@snackspot/shared'
import { created, err, parseBody, requireAuth, serverError, isResponse } from '@/lib/api-helpers'
import { createReview } from '@/lib/review-service'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, CreateReviewSchema)
  if (isResponse(body)) return body

  try {
    const result = await createReview({ userId: auth.sub, role: auth.role, input: body })
    if (!result.ok) return err(result.error, result.status)
    return created(result.value)
  } catch (e) {
    return serverError('reviews POST', e)
  }
}
