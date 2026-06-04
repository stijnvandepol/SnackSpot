import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { err, serverError, hasPrismaCode, mapPrismaError, parseBody, isResponse } from '@/lib/api-helpers'
import { Role } from '@prisma/client'
import type { Prisma } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

// GET /api/users/[id] - Get user details
export async function GET(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isVerified: true,
        bannedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            reviews: {
              where: {
                status: { not: 'DELETED' },
              },
            },
            reviewLikes: true,
            favorites: true,
          },
        },
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
    return serverError('user GET', e)
  }
}

const UpdateUserBody = z.object({
  email: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  isVerified: z.boolean().optional(),
  bannedAt: z.string().nullable().optional(),
})

// PATCH /api/users/[id] - Update user
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  const body = await parseBody(req, UpdateUserBody)
  if (isResponse(body)) return body
  const { email, username, role, isVerified, bannedAt } = body

  try {
    const updateData: Prisma.UserUpdateInput = {}
    if (email !== undefined) updateData.email = email
    if (username !== undefined) updateData.username = username
    if (role !== undefined) updateData.role = role
    if (isVerified !== undefined) updateData.isVerified = isVerified
    if (bannedAt !== undefined) updateData.bannedAt = bannedAt ? new Date(bannedAt) : null

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isVerified: true,
        bannedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error: unknown) {
    if (hasPrismaCode(error, 'P2002')) {
      return err('Email of username bestaat al', 400)
    }
    return (
      mapPrismaError(error, { notFound: 'Gebruiker niet gevonden' }) ??
      serverError('user PATCH', error)
    )
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  try {
    // Prevent self-deletion
    if (admin.sub === id) {
      return NextResponse.json(
        { error: 'Je kunt jezelf niet verwijderen' },
        { status: 400 }
      )
    }

    await db.user.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return (
      mapPrismaError(error, { notFound: 'Gebruiker niet gevonden' }) ??
      serverError('user DELETE', error)
    )
  }
}
