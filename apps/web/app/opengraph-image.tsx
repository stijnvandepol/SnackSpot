import { ImageResponse } from 'next/og'
import { POPPINS_500_WOFF_BASE64, POPPINS_700_WOFF_BASE64 } from '@/lib/share-card-fonts'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'SnackSpot: weet wat je moet bestellen voordat je gaat zitten'

function woff(base64: string): ArrayBuffer {
  const buf = Buffer.from(base64, 'base64')
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

/**
 * Site-wide social card (homepage, /product, anything without its own image). Same
 * typography as the review share card in lib/share-card.tsx, so a SnackSpot link looks
 * like SnackSpot wherever it lands.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(160deg, #F97316 0%, #FB923C 55%, #FDBA74 100%)',
          fontFamily: 'Poppins',
          color: '#1F2937',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: 'rgba(255,255,255,0.92)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 700,
              color: '#F97316',
            }}
          >
            S
          </div>
          <span style={{ fontSize: 38, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>SnackSpot</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.035em', maxWidth: 1000 }}>
            Weet wat je moet bestellen voordat je gaat zitten.
          </span>
          <span style={{ marginTop: 28, fontSize: 30, fontWeight: 500, color: 'rgba(31,41,55,0.75)' }}>
            Fotoreviews per gerecht van kleine snackplekken
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Poppins', data: woff(POPPINS_500_WOFF_BASE64), weight: 500, style: 'normal' },
        { name: 'Poppins', data: woff(POPPINS_700_WOFF_BASE64), weight: 700, style: 'normal' },
      ],
    },
  )
}
