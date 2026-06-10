import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { CUISINE_KEYS } from '@snackspot/shared'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseBody, serverError, mapPrismaError, isResponse } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

const RECENT_REVIEWS_LIMIT = 10

const UpdatePlaceBody = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  cuisine: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v === null || v === undefined || CUISINE_KEYS.includes(v), {
      message: 'Onbekende keuken',
    }),
})

// GET /api/places/[id] - Get place details
export async function GET(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  try {
    const place = await db.place.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        cuisine: true,
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
          take: RECENT_REVIEWS_LIMIT,
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
  } catch (e) {
    return serverError('place GET', e)
  }
}

// PATCH /api/places/[id] - Update place
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  const body = await parseBody(req, UpdatePlaceBody)
  if (isResponse(body)) return body
  const { name, address, lat, lng, city, cuisine } = body

  try {
    if (lat !== undefined && lng !== undefined) {
      await db.$executeRaw`
        UPDATE places
        SET
          name = COALESCE(${name}, name),
          address = COALESCE(${address}, address),
          location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          updated_at = NOW()
        WHERE id = ${id}
      `
    }

    const updateData: Prisma.PlaceUpdateInput = {}
    if (lat === undefined || lng === undefined) {
      if (name !== undefined) updateData.name = name
      if (address !== undefined) updateData.address = address
    }
    if (city !== undefined) updateData.city = city === '' ? null : city
    if (cuisine !== undefined) updateData.cuisine = cuisine

    if (Object.keys(updateData).length > 0) {
      await db.place.update({
        where: { id },
        data: updateData,
      })
    }

    const place = await db.place.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        cuisine: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ place })
  } catch (error: unknown) {
    return (
      mapPrismaError(error, { notFound: 'Restaurant niet gevonden' }) ??
      serverError('place PATCH', error)
    )
  }
}

// DELETE /api/places/[id] - Delete place
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = requireAdmin(req)
  if (isResponse(admin)) return admin
  const { id } = await params

  try {
    await db.place.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return (
      mapPrismaError(error, { notFound: 'Restaurant niet gevonden' }) ??
      serverError('place DELETE', error)
    )
  }
}
