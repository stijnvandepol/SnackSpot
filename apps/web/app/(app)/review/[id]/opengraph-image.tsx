import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { prisma } from '@/lib/db'
import { BUCKET, minioClient } from '@/lib/minio'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Review on SnackSpot'

const PHOTO_WIDTH = 560

/** Load the review's first photo from MinIO as a JPEG data URL.
 *  Satori cannot decode WebP, so the stored variant is transcoded via sharp. */
async function loadPhotoDataUrl(variants: unknown): Promise<string | null> {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return null
  const v = variants as Record<string, unknown>
  const key = [v.medium, v.large, v.thumb].find(
    (k): k is string => typeof k === 'string' && k.length > 0,
  )
  if (!key) return null

  try {
    const stream = await minioClient.getObject(BUCKET, key)
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const jpeg = await sharp(Buffer.concat(chunks))
      .resize({ width: PHOTO_WIDTH, height: size.height, fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    // Missing object or transcode failure: fall back to the text-only card.
    return null
  }
}

/** Star glyph support varies per embedded font; an inline SVG is deterministic. */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill={filled ? '#1F2937' : 'rgba(31,41,55,0.25)'}
    >
      <path d="M12 2l2.92 6.26L21.5 9.27l-4.75 4.38L17.84 20 12 16.6 6.16 20l1.09-6.35L2.5 9.27l6.58-1.01L12 2z" />
    </svg>
  )
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
      reviewPhotos: {
        orderBy: { sortOrder: 'asc' },
        take: 1,
        select: { photo: { select: { variants: true } } },
      },
    },
  })

  const heading = review?.dishName?.trim() || (review ? `Review of ${review.place.name}` : 'Review')
  const placeName = review?.place.name ?? ''
  const username = review?.user.username ?? ''
  const rating = review ? Number(review.ratingOverall) : 0
  const photoDataUrl = review
    ? await loadPhotoDataUrl(review.reviewPhotos[0]?.photo.variants)
    : null

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        {photoDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoDataUrl}
            alt=""
            width={PHOTO_WIDTH}
            height={size.height}
            style={{ width: PHOTO_WIDTH, height: size.height, objectFit: 'cover' }}
          />
        )}

        <div
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(160deg, #F97316 0%, #FB923C 55%, #FDBA74 100%)',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: photoDataUrl ? '56px 56px' : '64px 80px',
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
                fontSize: photoDataUrl ? (heading.length > 28 ? 44 : 56) : heading.length > 35 ? 60 : 76,
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex' }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} filled={rating >= s - 0.25} />
                ))}
              </div>
              <span style={{ fontSize: 38, fontWeight: 700, color: '#1F2937' }}>
                {rating > 0 ? rating.toFixed(1) : ''}
              </span>
            </div>
            {username && (
              <span style={{ marginTop: 14, fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                @{username}
              </span>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
