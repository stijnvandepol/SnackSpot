import { NextRequest, NextResponse } from 'next/server'
import { LoginSchema } from '@snackspot/shared'
import { db } from '@/lib/db'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige request body' },
        { status: 422 }
      )
    }
    const { email, password } = parsed.data

    // Find user
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        passwordHash: true,
      },
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Ongeldige inloggegevens' },
        { status: 401 }
      )
    }

    // Verify password
    const validPassword = await argon2.verify(user.passwordHash, password)
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Ongeldige inloggegevens' },
        { status: 401 }
      )
    }

    // Generate JWT token
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      env.JWT_ACCESS_SECRET,
      {
        algorithm: 'HS256',
        issuer: 'snackspot-admin',
        audience: 'snackspot-admin',
        expiresIn: '8h',
      }
    )

    return NextResponse.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Er is een fout opgetreden' },
      { status: 500 }
    )
  }
}
