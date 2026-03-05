import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: { id: string } }

// GET /api/places/[id] - Get place details
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const place = await db.place.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        address: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            reviews: {
              where: {
                status: { not: 'DELETED' },
              },
            },
            favorites: true,
          },
        },
        reviews: {
          where: {
            status: { not: 'DELETED' },
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rating: true,
            text: true,
            createdAt: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    })

    if (!place) {
      return NextResponse.json(
        { error: 'Restaurant niet gevonden' },
        { status: 404 }
      )
    }

    return NextResponse.json({ place })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error fetching place' },
      { status: 500 }
    )
  }
}

// PATCH /api/places/[id] - Update place
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const body = (await req.json()) as {
      name?: string
      address?: string
      lat?: number
      lng?: number
    }
    const { name, address, lat, lng } = body

    if (lat !== undefined && lng !== undefined) {
      // Update with new location
      await db.$executeRaw`
        UPDATE places
        SET 
          name = COALESCE(${name}, name),
          address = COALESCE(${address}, address),
          location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          updated_at = NOW()
        WHERE id = ${params.id}
      `
    } else {
      // Update without location
      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (address !== undefined) updateData.address = address

      await db.place.update({
        where: { id: params.id },
        data: updateData,
      })
    }

    const place = await db.place.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ place })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Restaurant niet gevonden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Error updating place' },
      { status: 500 }
    )
  }
}

// DELETE /api/places/[id] - Delete place
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    await db.place.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Restaurant niet gevonden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Error deleting place' },
      { status: 500 }
    )
  }
}
