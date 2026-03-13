import type { Metadata } from 'next'
import { prisma } from '@/lib/db'

function summarizeReview(text: string, maxLength = 150): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params

  const review = await prisma.review.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: {
      dishName: true,
      text: true,
      user: { select: { username: true } },
      place: { select: { name: true } },
    },
  })

  if (!review) {
    return {
      title: 'Review not found',
      robots: { index: false, follow: false },
      alternates: {
        canonical: `/review/${encodeURIComponent(id)}`,
      },
    }
  }

  const titleBase = review.dishName?.trim() || `Review of ${review.place.name}`
  const description = summarizeReview(review.text) || `${review.user.username} shared a review on SnackSpot.`

  return {
    title: `${titleBase}`,
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
      canonical: `/review/${encodeURIComponent(id)}`,
    },
  }
}

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
