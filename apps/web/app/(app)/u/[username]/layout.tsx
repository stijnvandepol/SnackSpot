import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { ReviewStatus } from '@prisma/client'

function summarizeBio(bio: string | null | undefined, maxLength = 150): string | null {
  if (!bio) return null
  const normalized = bio.replace(/\s+/g, ' ').trim()
  if (normalized.length === 0) return null
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const { username } = await params

  const user = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: 'insensitive' },
      bannedAt: null,
    },
    select: {
      username: true,
      bio: true,
      _count: {
        select: {
          reviews: {
            where: { status: ReviewStatus.PUBLISHED },
          },
        },
      },
    },
  })

  if (!user) {
    return {
      title: 'User not found',
      robots: { index: false, follow: false },
      alternates: {
        canonical: `/u/${encodeURIComponent(username)}`,
      },
    }
  }

  const reviewLabel = user._count.reviews === 1 ? '1 public review' : `${user._count.reviews} public reviews`
  const description =
    summarizeBio(user.bio) ??
    `${user.username} on SnackSpot. View ${reviewLabel} and recent food spot recommendations from this profile.`

  return {
    title: `@${user.username}`,
    description,
    openGraph: {
      title: `@${user.username} | SnackSpot`,
      description,
    },
    twitter: {
      title: `@${user.username} | SnackSpot`,
      description,
    },
    alternates: {
      canonical: `/u/${encodeURIComponent(username)}`,
    },
  }
}

export default function UserProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
