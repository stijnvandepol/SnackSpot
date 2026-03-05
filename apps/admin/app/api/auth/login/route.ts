import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as { email: string; password: string }

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

    if (!user) {
      return NextResponse.json(
        { error: 'Ongeldige inloggegevens' },
        { status: 401 }
      )
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Alleen admins hebben toegang tot het admin panel' },
        { status: 403 }
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
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Er is een fout opgetreden' },
      { status: 500 }
    )
  }
}
