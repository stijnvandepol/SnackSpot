import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #F97316 0%, #FB923C 55%, #FDBA74 100%)',
          color: '#1F2937',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 800,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 0.9, letterSpacing: '-0.03em' }}>
          <span style={{ fontSize: 152 }}>Snack</span>
          <span style={{ fontSize: 152 }}>Spot</span>
          <span style={{ marginTop: 24, fontSize: 40, fontWeight: 600 }}>Discover and share great food</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
