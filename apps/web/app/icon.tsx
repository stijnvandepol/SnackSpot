import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '110px',
          background: 'linear-gradient(160deg, #F97316 0%, #FB923C 55%, #FDBA74 100%)',
          color: '#1F2937',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 800,
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, letterSpacing: '-0.02em' }}>
          <span style={{ fontSize: 108 }}>Snack</span>
          <span style={{ fontSize: 108 }}>Spot</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
