import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseQuery, parseBody, serverError, isResponse } from '@/lib/api-helpers'

const ListPlacesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().default(''),
  withoutReviews: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

const CreatePlaceBody = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
})

// GET /api/places - List all places
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  const query = parseQuery(req, ListPlacesQuery)
  if (isResponse(query)) return query
  const { page, limit, search, withoutReviews } = query

  try {
    const where: Prisma.PlaceWhereInput = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { address: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    if (withoutReviews) {
      where.reviews = {
        none: {
          status: { not: 'DELETED' },
        },
      }
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
  } catch (e) {
    return serverError('places GET', e)
  }
}

// POST /api/places - Create a new place
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  const body = await parseBody(req, CreatePlaceBody)
  if (isResponse(body)) return body
  const { name, address, lat, lng } = body

  try {
    // Create place with PostGIS geography point
    const [inserted] = await db.$queryRaw<Array<{ id: string }>>`
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
    const place = await db.place.findUnique({
      where: { id: inserted.id },
      select: {
        id: true,
        name: true,
        address: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ place }, { status: 201 })
  } catch (e) {
    return serverError('places POST', e)
  }
}

// DELETE /api/places/bulk - Delete places without reviews
export async function DELETE(req: NextRequest) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin

  try {
    const result = await db.place.deleteMany({
      where: {
        reviews: {
          none: {
            status: { not: 'DELETED' },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    })
  } catch (e) {
    return serverError('places DELETE', e)
  }
}
