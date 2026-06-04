import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseBody, serverError, mapPrismaError, isResponse } from '@/lib/api-helpers'

const MAX_WORD_LENGTH = 100

const AddBlockedWordBody = z.object({
  word: z.string().optional(),
})

// GET /api/comments/blocked-words - List all blocked words
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  try {
    const words = await db.blockedWord.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, word: true, createdAt: true },
    })
    return NextResponse.json({ words })
  } catch (e) {
    return serverError('blocked-words GET', e)
  }
}

// POST /api/comments/blocked-words - Add a new blocked word
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  const body = await parseBody(req, AddBlockedWordBody)
  if (isResponse(body)) return body
  const { word } = body

  try {
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
    return (
      mapPrismaError(error, { conflict: 'Dit woord bestaat al' }) ??
      serverError('blocked-words POST', error)
    )
  }
}
