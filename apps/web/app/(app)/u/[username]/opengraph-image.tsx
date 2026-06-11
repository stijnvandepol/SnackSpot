import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/db'
import { ReviewStatus } from '@prisma/client'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function UserOpenGraphImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' }, bannedAt: null },
    select: {
      username: true,
      _count: { select: { reviews: { where: { status: ReviewStatus.PUBLISHED } } } },
    },
  })

  const displayName = user?.username ?? username
  const reviewCount = user?._count.reviews ?? 0
  const reviewLabel = reviewCount === 1 ? '1 review' : `${reviewCount} reviews`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(160deg, #F97316 0%, #FB923C 55%, #FDBA74 100%)',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '64px 80px',
        }}
      >
        {/* Top label */}
        <span style={{ fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          SnackSpot
        </span>

        {/* Username */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span
            style={{
              fontSize: displayName.length > 20 ? 72 : 96,
              fontWeight: 800,
              color: '#1F2937',
              lineHeight: 1.0,
              letterSpacing: '-0.03em',
            }}
          >
            @{displayName}
          </span>
        </div>

        {/* Review count */}
        <span style={{ fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
          {reviewLabel} · Food Reviews
        </span>
      </div>
    ),
    { ...size },
  )
}
