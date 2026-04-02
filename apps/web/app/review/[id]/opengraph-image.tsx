import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function starString(rating: number): string {
  const full = Math.round(rating)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

export default async function ReviewOpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const review = await prisma.review.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: {
      dishName: true,
      ratingOverall: true,
      user: { select: { username: true } },
      place: { select: { name: true } },
    },
  })

  const heading = review?.dishName?.trim() || (review ? `Review of ${review.place.name}` : 'Review')
  const placeName = review?.place.name ?? ''
  const username = review?.user.username ?? ''
  const rating = review ? Number(review.ratingOverall) : 0

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

        {/* Dish name / heading */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span
            style={{
              fontSize: heading.length > 35 ? 60 : 76,
              fontWeight: 800,
              color: '#1F2937',
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              maxWidth: 900,
            }}
          >
            {heading}
          </span>
          {placeName && (
            <span style={{ marginTop: 16, fontSize: 32, fontWeight: 500, color: '#374151' }}>
              {placeName}
            </span>
          )}
        </div>

        {/* Bottom row: stars + author */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 40, color: '#1F2937', letterSpacing: 2 }}>{starString(rating)}</span>
          {username && (
            <span style={{ fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              @{username}
            </span>
          )}
        </div>
      </div>
    ),
    { ...size },
  )
}
