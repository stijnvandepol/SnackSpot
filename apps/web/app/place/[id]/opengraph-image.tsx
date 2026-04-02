import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/db'
import { extractCity } from '@/lib/utils'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function PlaceOpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const place = await prisma.place.findUnique({
    where: { id },
    select: {
      name: true,
      address: true,
      _count: { select: { reviews: { where: { status: 'PUBLISHED' } } } },
    },
  })

  const name = place?.name ?? 'Food Spot'
  const city = place ? (extractCity(place.address) ?? place.address) : ''
  const reviewCount = place?._count.reviews ?? 0
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

        {/* Place name */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span
            style={{
              fontSize: name.length > 30 ? 64 : 80,
              fontWeight: 800,
              color: '#1F2937',
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              maxWidth: 900,
            }}
          >
            {name}
          </span>
          {city && (
            <span style={{ marginTop: 16, fontSize: 36, fontWeight: 500, color: '#374151' }}>
              {city}
            </span>
          )}
        </div>

        {/* Review count */}
        <span style={{ fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
          {reviewLabel}
        </span>
      </div>
    ),
    { ...size },
  )
}
