import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: { id: string } }

// GET /api/users/[id] - Get user details
export async function GET(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    const user = await db.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
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
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error fetching user' },
      { status: 500 }
    )
  }
}

// PATCH /api/users/[id] - Update user
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    const body = (await req.json()) as {
      email?: string
      username?: string
      role?: 'USER' | 'ADMIN'
      bannedAt?: string | null
    }
    const { email, username, role, bannedAt } = body

    const updateData: any = {}
    if (email !== undefined) updateData.email = email
    if (username !== undefined) updateData.username = username
    if (role !== undefined) updateData.role = role
    if (bannedAt !== undefined) updateData.bannedAt = bannedAt ? new Date(bannedAt) : null

    const user = await db.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        bannedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email of username bestaat al' },
        { status: 400 }
      )
    }
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Gebruiker niet gevonden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Error updating user' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  try {
    // Prevent self-deletion
    if (admin.sub === params.id) {
      return NextResponse.json(
        { error: 'Je kunt jezelf niet verwijderen' },
        { status: 400 }
      )
    }

    await db.user.delete({
      where: { id: params.id },
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
      { error: 'Error deleting user' },
      { status: 500 }
    )
  }
}
