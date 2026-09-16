import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { ReviewStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { BUCKET, minioClient } from '@/lib/minio'
import { extractCity } from '@/lib/utils'
import { formatShareRating } from '@/lib/share'
import { POPPINS_500_WOFF_BASE64, POPPINS_700_WOFF_BASE64 } from '@/lib/share-card-fonts'

/**
 * The 1200×630 card behind og:image on review pages — what WhatsApp, iMessage, Signal and
 * the social networks show under a shared link.
 *
 * Why a JPEG route and not the `opengraph-image.tsx` file convention:
 *  - WhatsApp only renders the large photo preview when og:image is under roughly 300 KB.
 *    A photographic PNG at this size is 500 KB to 1 MB; the same card as JPEG q82 is ~120 KB.
 *    `ImageResponse` can only emit PNG, so the PNG is transcoded here with sharp.
 *  - The file convention publishes at a hashed URL (`/opengraph-image-<hash>`) that
 *    generateMetadata cannot reference, and generateMetadata's own `images` overrode it —
 *    the live pages were sending the raw 700 KB WebP variant. A plain `/card.jpg` path is
 *    addressable, and its extension makes Cloudflare cache it at the edge by default.
 */

export const SHARE_CARD_WIDTH = 1200
export const SHARE_CARD_HEIGHT = 630
const PHOTO_WIDTH = 600
const JPEG_QUALITY = 82

const INK = '#1F2937'
const INK_SOFT = 'rgba(31,41,55,0.72)'

function woff(base64: string): ArrayBuffer {
  const buf = Buffer.from(base64, 'base64')
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

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
      .resize({ width: PHOTO_WIDTH, height: SHARE_CARD_HEIGHT, fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    // Missing object or transcode failure: fall back to the text-only card.
    return null
  }
}

/** Star glyph support varies per embedded font; an inline SVG is deterministic. */
function Star({ fill, index }: { fill: number; index: number }) {
  // fill: 0 (empty), 0.5 (half) or 1 (full)
  const id = `half-${index}`
  return (
    <svg width="34" height="34" viewBox="0 0 24 24">
      {fill === 0.5 && (
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor={INK} />
            <stop offset="50%" stopColor="rgba(31,41,55,0.22)" />
          </linearGradient>
        </defs>
      )}
      <path
        fill={fill === 1 ? INK : fill === 0.5 ? `url(#${id})` : 'rgba(31,41,55,0.22)'}
        d="M12 2l2.92 6.26L21.5 9.27l-4.75 4.38L17.84 20 12 16.6 6.16 20l1.09-6.35L2.5 9.27l6.58-1.01L12 2z"
      />
    </svg>
  )
}

function starFill(rating: number, index: number): number {
  const remainder = rating - (index - 1)
  if (remainder >= 0.75) return 1
  if (remainder >= 0.25) return 0.5
  return 0
}

export interface ShareCardData {
  heading: string
  placeName: string
  city: string | null
  username: string
  rating: number
  photoDataUrl: string | null
}

function ShareCard({ heading, placeName, city, username, rating, photoDataUrl }: ShareCardData) {
  const headingSize = photoDataUrl
    ? heading.length > 30 ? 44 : heading.length > 18 ? 54 : 64
    : heading.length > 30 ? 64 : 84

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', fontFamily: 'Poppins' }}>
      {photoDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoDataUrl}
          alt=""
          width={PHOTO_WIDTH}
          height={SHARE_CARD_HEIGHT}
          style={{ width: PHOTO_WIDTH, height: SHARE_CARD_HEIGHT, objectFit: 'cover' }}
        />
      )}

      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(160deg, #F97316 0%, #FB923C 55%, #FDBA74 100%)',
          padding: photoDataUrl ? '52px 56px' : '64px 88px',
        }}
      >
        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.92)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // A letter mark rather than an emoji: satori has no emoji font unless one is
              // loaded per glyph, and a missing glyph renders as an empty box.
              fontSize: 28,
              fontWeight: 700,
              color: '#F97316',
            }}
          >
            S
          </div>
          <span style={{ fontSize: 30, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            SnackSpot
          </span>
        </div>

        {/* Dish + place */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: headingSize,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.04,
              letterSpacing: '-0.03em',
              // satori has no line-clamp; keep long dish names from pushing the footer off.
              maxHeight: headingSize * 1.04 * 3,
              overflow: 'hidden',
            }}
          >
            {heading}
          </span>
          {placeName && (
            <span
              style={{
                marginTop: 18,
                fontSize: 30,
                fontWeight: 500,
                color: INK_SOFT,
                lineHeight: 1.25,
                maxHeight: 30 * 1.25 * 2,
                overflow: 'hidden',
              }}
            >
              {city ? `${placeName} · ${city}` : placeName}
            </span>
          )}
        </div>

        {/* Rating + author */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} index={s} fill={starFill(rating, s)} />
                ))}
              </div>
              <span style={{ fontSize: 40, fontWeight: 700, color: INK, marginLeft: 6 }}>
                {rating > 0 ? formatShareRating(rating) : ''}
              </span>
            </div>
            {username && (
              <span style={{ marginTop: 10, fontSize: 24, fontWeight: 500, color: 'rgba(255,255,255,0.95)' }}>
                Fotoreview van @{username}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders the share card for a published review as a JPEG buffer, or null when the review
 * does not exist or is not public. Hidden and deleted reviews get no card: a stale WhatsApp
 * preview must not keep advertising content that was taken down.
 */
export async function renderShareCardJpeg(data: ShareCardData): Promise<Buffer> {
  const png = new ImageResponse(<ShareCard {...data} />, {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    fonts: [
      { name: 'Poppins', data: woff(POPPINS_500_WOFF_BASE64), weight: 500, style: 'normal' },
      { name: 'Poppins', data: woff(POPPINS_700_WOFF_BASE64), weight: 700, style: 'normal' },
    ],
  })

  return sharp(Buffer.from(await png.arrayBuffer()))
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}

export async function renderReviewShareCard(reviewId: string): Promise<Buffer | null> {
  const review = await prisma.review.findFirst({
    where: { id: reviewId, status: ReviewStatus.PUBLISHED },
    select: {
      dishName: true,
      ratingOverall: true,
      user: { select: { username: true } },
      place: { select: { name: true, address: true, city: true } },
      reviewPhotos: {
        orderBy: { sortOrder: 'asc' },
        take: 1,
        select: { photo: { select: { variants: true } } },
      },
    },
  })
  if (!review) return null

  const data: ShareCardData = {
    heading: review.dishName?.trim() || `Review van ${review.place.name}`,
    placeName: review.place.name,
    city: review.place.city?.trim() || extractCity(review.place.address),
    username: review.user.username,
    rating: Number(review.ratingOverall),
    photoDataUrl: await loadPhotoDataUrl(review.reviewPhotos[0]?.photo.variants),
  }

  return renderShareCardJpeg(data)
}
