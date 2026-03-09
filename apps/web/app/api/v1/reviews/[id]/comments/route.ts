import { type NextRequest } from 'next/server'
import { CreateCommentSchema } from '@snackspot/shared'
import { prisma } from '@/lib/db'
import {
  ok,
  created,
  err,
  parseBody,
  requireAuth,
  getAuthPayload,
  isResponse,
  serverError,
  withNoStore,
} from '@/lib/api-helpers'
import { ReviewStatus } from '@prisma/client'
import { rateLimitUser } from '@/lib/rate-limit'
import { recalculateUserBadges } from '@/lib/badge-service'
import { notifyCommentMention, notifyReviewComment } from '@/lib/notification-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = getAuthPayload(req)

  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '20')
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.trunc(limitRaw))) : 20

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true },
    })

    if (!review || review.status === ReviewStatus.DELETED) return err('Review not found', 404)
    if (review.status === ReviewStatus.HIDDEN) {
      const isOwner = auth?.sub === review.userId
      const isMod = auth?.role === 'MODERATOR' || auth?.role === 'ADMIN'
      if (!isOwner && !isMod) return err('Review not found', 404)
    }

    const comments = await prisma.comment.findMany({
      where: { reviewId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        text: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: { select: { id: true, username: true, avatarKey: true, role: true } },
      },
    })

    return withNoStore(ok(comments.map((comment: (typeof comments)[number]) => ({
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: comment.user,
      canDelete: Boolean(auth && (auth.sub === comment.userId || auth.role === 'MODERATOR' || auth.role === 'ADMIN')),
    }))))
  } catch (e) {
    return serverError('reviews/[id]/comments GET', e)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth

  const rl = await rateLimitUser(auth.sub, 'comment_create', 40, 3600)
  if (!rl.allowed) return err('Comment rate limit exceeded', 429)

  const body = await parseBody<{ text: string }>(req, CreateCommentSchema)
  if (isResponse(body)) return body

  const text = body.text.trim()
  if (!text) return err('Comment text is required', 422)

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { status: true, userId: true },
    })
    if (!review || review.status !== ReviewStatus.PUBLISHED) {
      return err('Review not found', 404)
    }

    const comment = await prisma.comment.create({
      data: {
        reviewId: id,
        userId: auth.sub,
        text,
      },
      select: {
        id: true,
        text: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, username: true, avatarKey: true, role: true } },
      },
    })

    // Check comment text against blocked words and flag if matched
    const blockedWords = await prisma.blockedWord.findMany({ select: { word: true } })
    const matchedWord = blockedWords.find((bw) =>
      text.toLowerCase().includes(bw.word.toLowerCase()),
    )
    if (matchedWord) {
      await prisma.flaggedComment.create({
        data: { commentId: comment.id, matchedWord: matchedWord.word },
      })
    }

    // Notify review owner about the comment
    await notifyReviewComment(id, comment.id, auth.sub)
    await recalculateUserBadges(review.userId, { criteriaTypes: ['COMMENTS_RECEIVED_COUNT'] })

    const mentionMatches = text.match(/@(\w{3,30})/g) ?? []
    const mentionedUsernames = [...new Set(mentionMatches.map((match) => match.slice(1).toLowerCase()))]

    if (mentionedUsernames.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          bannedAt: null,
          OR: mentionedUsernames.map((username) => ({
            username: { equals: username, mode: 'insensitive' },
          })),
        },
        select: { id: true },
      })

      const mentionedUserIds = [...new Set(mentionedUsers.map((user) => user.id))]
        .filter((userId) => userId !== auth.sub && userId !== review.userId)

      await Promise.allSettled(
        mentionedUserIds.map((userId) => notifyCommentMention(userId, id, comment.id, auth.sub)),
      )
    }

    return created({
      ...comment,
      canDelete: true,
    })
  } catch (e) {
    return serverError('reviews/[id]/comments POST', e)
  }
}
