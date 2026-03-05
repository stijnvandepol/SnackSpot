import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import argon2 from 'argon2'

// GET /api/users - List all users
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const search = url.searchParams.get('search') || ''

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          bannedAt: true,
          createdAt: true,
          _count: {
            select: {
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching users' },
      { status: 500 }
    )
  }
}

// POST /api/users - Create a new user
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const { email, username, password, role } = (await req.json()) as {
      email: string
      username: string
      password: string
      role?: 'USER' | 'ADMIN'
    }

    // Validate input
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Email, username en wachtwoord zijn verplicht' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await argon2.hash(password)

    // Create user
    const user = await db.user.create({
      data: {
        email,
        username,
        passwordHash,
        role: role || 'USER',
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email of username bestaat al' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Error creating user' },
      { status: 500 }
    )
  }
}
