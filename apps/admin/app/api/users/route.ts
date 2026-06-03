import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseQuery, parseBody, serverError, mapPrismaError, isResponse } from '@/lib/api-helpers'
import argon2 from 'argon2'

const ListUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().default(''),
})

const CreateUserBody = z.object({
  email: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.nativeEnum(Role).optional(),
})

// GET /api/users - List all users
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  const query = parseQuery(req, ListUsersQuery)
  if (isResponse(query)) return query
  const { page, limit, search } = query

  try {
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
          isVerified: true,
          bannedAt: true,
          createdAt: true,
          _count: {
            select: {
              reviews: {
                where: {
                  status: { not: 'DELETED' },
                },
              },
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
  } catch (e) {
    return serverError('users GET', e)
  }
}

// POST /api/users - Create a new user
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  const body = await parseBody(req, CreateUserBody)
  if (isResponse(body)) return body
  const { email, username, password, role } = body

  try {
    const passwordHash = await argon2.hash(password)

    const user = await db.user.create({
      data: {
        email,
        username,
        passwordHash,
        role: role ?? 'USER',
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
  } catch (error: unknown) {
    return (
      mapPrismaError(error, { conflict: 'Email of username bestaat al' }) ??
      serverError('users POST', error)
    )
  }
}
