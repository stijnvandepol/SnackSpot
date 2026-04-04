import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { extractCity } from '@/lib/utils'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params

  const place = await prisma.place.findUnique({
    where: { id },
    select: {
      name: true,
      address: true,
      _count: {
        select: {
          reviews: {
            where: { status: 'PUBLISHED' },
          },
        },
      },
    },
  })

  if (!place) {
    notFound()
  }

  const city = extractCity(place.address)
  const titleBase = city ? `${place.name} in ${city}` : place.name
  const reviewLabel = place._count.reviews === 1 ? '1 review' : `${place._count.reviews} reviews`
  const description = `${place.name} on SnackSpot. View ${reviewLabel}, the address, and community recommendations for this food spot.`

  return {
    title: titleBase,
    description,
    openGraph: {
      title: `${titleBase} | SnackSpot`,
      description,
    },
    twitter: {
      title: `${titleBase} | SnackSpot`,
      description,
    },
    alternates: {
      canonical: `/place/${encodeURIComponent(id)}`,
    },
  }
}

export default function PlaceLayout({ children }: { children: React.ReactNode }) {
  return children
}
