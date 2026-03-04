import { type NextRequest } from 'next/server'
import { UpdateReviewSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import {
  ok,
  noContent,
  err,
  parseBody,
  requireAuth,
  serverError,
  isResponse,
} from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: {
        id: true,
        rating: true,
        text: true,
        dishName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, username: true, avatarKey: true, role: true } },
        place: { select: { id: true, name: true, address: true } },
        reviewPhotos: {
          orderBy: { sortOrder: 'asc' },
          select: { sortOrder: true, photo: { select: { id: true, variants: true, metadata: true } } },
        },
      },
    })

    if (!review) return err('Review not found', 404)
    if (review.status === ReviewStatus.DELETED) return err('Review not found', 404)

    return ok(review)
  } catch (e) {
    return serverError('reviews/[id] GET', e)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const body = await parseBody(req, UpdateReviewSchema)
  if (isResponse(body)) return body

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, status: true },
    })
    if (!review || review.status === ReviewStatus.DELETED) return err('Review not found', 404)

    // Only the owner can edit
    if (review.userId !== auth.sub) return err('Forbidden', 403)

    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(body.rating !== undefined && { rating: body.rating }),
        ...(body.text !== undefined && { text: body.text }),
        ...(body.dishName !== undefined && { dishName: body.dishName }),
      },
      select: { id: true, rating: true, text: true, dishName: true, updatedAt: true },
    })
    return ok(updated)
  } catch (e) {
    return serverError('reviews/[id] PATCH', e)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, status: true },
    })
    if (!review || review.status === ReviewStatus.DELETED) return err('Review not found', 404)

    // Owner or admin/mod may soft-delete
    const isOwner = review.userId === auth.sub
    const isMod = auth.role === 'MODERATOR' || auth.role === 'ADMIN'
    if (!isOwner && !isMod) return err('Forbidden', 403)

    await prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.DELETED },
    })
    return noContent()
  } catch (e) {
    return serverError('reviews/[id] DELETE', e)
  }
}
