import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { serverError, isResponse } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const payload = requireAdmin(req)
  if (isResponse(payload)) return payload

  try {
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Gebruiker niet gevonden' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (e) {
    return serverError('admin me', e)
  }
}
