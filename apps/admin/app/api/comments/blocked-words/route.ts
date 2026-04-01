import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

const MAX_WORD_LENGTH = 100

// GET /api/comments/blocked-words - List all blocked words
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    const words = await db.blockedWord.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, word: true, createdAt: true },
    })
    return NextResponse.json({ words })
  } catch {
    return NextResponse.json({ error: 'Error fetching blocked words' }, { status: 500 })
  }
}

// POST /api/comments/blocked-words - Add a new blocked word
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    const { word } = (await req.json()) as { word?: string }
    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return NextResponse.json({ error: 'Woord is verplicht' }, { status: 400 })
    }

    const normalized = word.trim().toLowerCase()
    if (normalized.length > MAX_WORD_LENGTH) {
      return NextResponse.json({ error: `Woord mag maximaal ${MAX_WORD_LENGTH} tekens zijn` }, { status: 400 })
    }

    const created = await db.blockedWord.create({
      data: { word: normalized, createdBy: admin.sub },
      select: { id: true, word: true, createdAt: true },
    })

    return NextResponse.json({ word: created }, { status: 201 })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Dit woord bestaat al' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error adding blocked word' }, { status: 500 })
  }
}
