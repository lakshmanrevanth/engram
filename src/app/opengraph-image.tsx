import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';

export const alt = `${siteConfig.name}: ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Same accent as the "." in the in-app wordmark.
const ACCENT = '#ff6b00';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 96px',
          background: '#080808',
          backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(255,107,0,0.18), transparent 45%)',
          color: '#ffffff',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', fontSize: 148, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}>
          {siteConfig.logoWord}
          <span style={{ color: ACCENT }}>.</span>
        </div>
        <div style={{ display: 'flex', marginTop: 36, fontSize: 48, color: '#e4e4e7', letterSpacing: '-0.01em' }}>
          {siteConfig.tagline}
        </div>
        <div style={{ display: 'flex', marginTop: 20, fontSize: 28, color: '#a1a1aa' }}>
          Spaced repetition for coding problems and system design.
        </div>
      </div>
    ),
    size,
  );
}
