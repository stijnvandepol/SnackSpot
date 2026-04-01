import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getSiteUrl } from '@/lib/site-url'
import { AvatarLightbox } from '@/components/avatar-lightbox'
import { UserReviewsList } from '@/components/user-reviews-list'
import { VerifiedBadge } from '@/components/verified-badge'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

function formatDate(dateInput: Date) {
  return dateFormatter.format(dateInput)
}

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' }, bannedAt: null },
    select: {
      id: true,
      username: true,
      bio: true,
      avatarKey: true,
      role: true,
      isVerified: true,
      createdAt: true,
      _count: { select: { reviews: { where: { status: 'PUBLISHED' } }, favorites: true } },
    },
  })

  if (!user) notFound()

  const [{ total_likes }] = await prisma.$queryRaw<Array<{ total_likes: number }>>`
    SELECT COUNT(rl.review_id)::int AS total_likes
    FROM review_likes rl
    INNER JOIN reviews r ON r.id = rl.review_id
    WHERE r.user_id = ${user.id} AND r.status = 'PUBLISHED'
  `

  const profileJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: user.username,
      url: `${getSiteUrl()}/u/${encodeURIComponent(user.username)}`,
      ...(user.bio?.trim() ? { description: user.bio.trim() } : {}),
    },
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }} />
      <div className="card p-6 mb-6 flex items-center gap-4">
        <AvatarLightbox
          avatarKey={user.avatarKey}
          username={user.username}
          size="lg"
        />
        <div className="min-w-0">
          <h1 className="font-heading font-bold text-xl text-snack-text flex items-center gap-1.5">
            {user.username}
            {user.isVerified && <VerifiedBadge className="w-5 h-5" />}
          </h1>
          <p className="text-sm text-snack-muted">@{user.username}</p>
          <p className="text-xs text-snack-muted mt-1">{user.bio?.trim() || 'SnackSpot member'}</p>
          <p className="text-xs text-snack-muted mt-1">Joined {formatDate(user.createdAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-snack-text">{user._count.reviews}</p>
          <p className="text-xs text-snack-muted">Posts</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-snack-text">{total_likes}</p>
          <p className="text-xs text-snack-muted">Likes received</p>
        </div>
      </div>

      <h2 className="font-heading font-semibold text-snack-text mb-4">Reviews</h2>
      <UserReviewsList username={user.username} />

      <div className="mt-6 text-center">
        <Link href="/" className="btn-secondary text-sm">Back to Feed</Link>
      </div>
    </div>
  )
}
