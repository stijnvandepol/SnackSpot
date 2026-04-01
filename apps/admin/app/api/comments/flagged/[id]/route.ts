import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

const VALID_ACTIONS = ['APPROVE', 'DELETE'] as const
type FlagAction = (typeof VALID_ACTIONS)[number]

// PATCH /api/comments/flagged/[id] - Approve or delete a flagged comment
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin
  const { id } = await params

  try {
    const { action } = (await req.json()) as { action: FlagAction }

    if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 })
    }

    const flagged = await db.flaggedComment.findUnique({
      where: { id: id },
      select: { commentId: true, status: true },
    })

    if (!flagged) {
      return NextResponse.json({ error: 'Gemarkeerde comment niet gevonden' }, { status: 404 })
    }

    if (flagged.status !== 'PENDING') {
      return NextResponse.json({ error: 'Comment is al beoordeeld' }, { status: 409 })
    }

    if (action === 'DELETE') {
      // Delete the actual comment (cascade deletes the flagged_comment too)
      await db.comment.delete({ where: { id: flagged.commentId } })
    } else {
      // Approve: just update the flag status
      await db.flaggedComment.update({
        where: { id: id },
        data: { status: 'APPROVED', reviewedBy: admin.sub, reviewedAt: new Date() },
      })
    }

    await db.moderationAction.create({
      data: {
        moderatorId: admin.sub,
        actionType: action === 'DELETE' ? 'DELETE_REVIEW' : 'DISMISS_REPORT',
        targetType: 'COMMENT',
        targetId: flagged.commentId,
        note: action === 'DELETE' ? 'Comment verwijderd via triggerwoord moderatie' : 'Comment goedgekeurd via triggerwoord moderatie',
      },
    })

    return NextResponse.json({ success: true, action })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Error processing action' }, { status: 500 })
  }
}
