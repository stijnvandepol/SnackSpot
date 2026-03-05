import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import argon2 from 'argon2'

type Params = { params: { id: string } }

// POST /api/users/[id]/reset-password - Reset user password
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const { password } = await req.json()

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Wachtwoord moet minimaal 8 karakters zijn' },
        { status: 400 }
      )
    }

    const passwordHash = await argon2.hash(password)

    await db.user.update({
      where: { id: params.id },
      data: { passwordHash },
    })

    // Delete all refresh tokens to force re-login
    await db.refreshToken.deleteMany({
      where: { userId: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Gebruiker niet gevonden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Error resetting password' },
      { status: 500 }
    )
  }
}
