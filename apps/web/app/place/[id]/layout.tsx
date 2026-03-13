import type { Metadata } from 'next'
import { prisma } from '@/lib/db'

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
    return {
      title: 'Place not found',
      robots: { index: false, follow: false },
      alternates: {
        canonical: `/place/${encodeURIComponent(id)}`,
      },
    }
  }

  const reviewLabel = place._count.reviews === 1 ? '1 review' : `${place._count.reviews} reviews`
  const description = `${place.name} on SnackSpot. View ${reviewLabel}, the address, and community recommendations for this food spot.`

  return {
    title: `${place.name}`,
    description,
    openGraph: {
      title: `${place.name} | SnackSpot`,
      description,
    },
    twitter: {
      title: `${place.name} | SnackSpot`,
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
