import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: { id: string } }

// DELETE /api/comments/blocked-words/[id] - Remove a blocked word
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    await db.blockedWord.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Woord niet gevonden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Error deleting blocked word' }, { status: 500 })
  }
}
