import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { serverError, mapPrismaError, isResponse } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

// DELETE /api/comments/blocked-words/[id] - Remove a blocked word
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  try {
    await db.blockedWord.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return (
      mapPrismaError(error, { notFound: 'Woord niet gevonden' }) ??
      serverError('blocked-words DELETE', error)
    )
  }
}
