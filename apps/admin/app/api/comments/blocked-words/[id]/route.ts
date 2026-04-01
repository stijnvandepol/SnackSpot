import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// DELETE /api/comments/blocked-words/[id] - Remove a blocked word
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin
  const { id } = await params

  try {
    await db.blockedWord.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Woord niet gevonden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Error deleting blocked word' }, { status: 500 })
  }
}
