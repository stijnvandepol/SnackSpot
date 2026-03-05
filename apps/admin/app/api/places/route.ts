import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/places - List all places
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const search = url.searchParams.get('search') || ''
    const withoutReviews = url.searchParams.get('withoutReviews') === 'true'

    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { address: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    if (withoutReviews) {
      where.reviews = { none: {} }
    }

    const [places, total] = await Promise.all([
      db.place.findMany({
        where,
        select: {
          id: true,
          name: true,
          address: true,
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
      db.place.count({ where }),
    ])

    return NextResponse.json({
      places,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error fetching places' },
      { status: 500 }
    )
  }
}

// POST /api/places - Create a new place
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const { name, address, lat, lng } = (await req.json()) as {
      name: string
      address: string
      lat: number
      lng: number
    }

    if (!name || !address || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'Naam, adres, lat en lng zijn verplicht' },
        { status: 400 }
      )
    }

    // Create place with PostGIS geography point
    const result = await db.$executeRaw`
      INSERT INTO places (id, name, address, location, created_at, updated_at)
      VALUES (
        gen_random_uuid()::text,
        ${name},
        ${address},
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        NOW(),
        NOW()
      )
      RETURNING id
    `

    // Get the created place
    const place = await db.place.findFirst({
      where: { name, address },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        address: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ place }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error creating place' },
      { status: 500 }
    )
  }
}

// DELETE /api/places/bulk - Delete places without reviews
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    await requireAdmin(authHeader)

    const result = await db.place.deleteMany({
      where: {
        reviews: { none: {} },
      },
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error deleting places' },
      { status: 500 }
    )
  }
}
