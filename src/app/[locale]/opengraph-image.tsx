import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const alt = 'Mugdm — Business Management Platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const COPY = {
  headline: 'Small Business Management Platform',
  subline: 'Documents · Compliance · Bookkeeping · Team',
  tagline: 'The operating system for Saudi micro-enterprises',
} as const

export default async function OgImage() {
  const copy = COPY

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
        dir="ltr"
      >
        {/* Grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.06,
            backgroundImage:
              'linear-gradient(rgba(30,64,175,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.8) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Glow orb top-left */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(30,64,175,0.3) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* Glow orb bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            right: -80,
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            position: 'relative',
            zIndex: 1,
            padding: '0 60px',
            textAlign: 'center',
          }}
        >
          {/* Logo mark */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #1E40AF 0%, #7C3AED 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                fontWeight: 800,
                color: 'white',
                boxShadow: '0 8px 32px rgba(30,64,175,0.4)',
              }}
            >
              م
            </div>
            <span
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: 'white',
                letterSpacing: '-0.03em',
              }}
            >
              Mugdm
            </span>
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.2,
              maxWidth: 800,
            }}
          >
            {copy.headline}
          </div>

          {/* Feature dots */}
          <div
            style={{
              fontSize: 22,
              color: 'rgba(148,163,184,1)',
              letterSpacing: '0.02em',
            }}
          >
            {copy.subline}
          </div>

          {/* Divider line */}
          <div
            style={{
              width: 80,
              height: 3,
              borderRadius: 2,
              background: 'linear-gradient(90deg, #1E40AF, #7C3AED)',
              marginTop: 4,
              marginBottom: 4,
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: 18,
              color: 'rgba(148,163,184,0.7)',
              fontWeight: 500,
            }}
          >
            {copy.tagline}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #1E40AF, #7C3AED, #1E40AF)',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
