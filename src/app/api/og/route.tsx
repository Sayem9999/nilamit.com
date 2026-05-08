import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const fontURL = 'https://github.com/google/fonts/raw/main/ofl/notosansbengali/NotoSansBengali-Bold.ttf';
const ALLOWED_IMAGE_HOSTS = [
  'utfs.io',
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'uploadthing.com',
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',
] as const;

function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;

    const host = url.hostname.toLowerCase();
    return (
      ALLOWED_IMAGE_HOSTS.includes(host as (typeof ALLOWED_IMAGE_HOSTS)[number]) ||
      host.endsWith('.uploadthing.com')
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const fontData = await fetch(new URL(fontURL)).then((res) => res.arrayBuffer());
    
    const { searchParams } = new URL(req.url);

    // Params
    const title = searchParams.get('title') || 'Auction on Nilamit';
    const price = searchParams.get('price') || '0';
    const image = searchParams.get('image');
    const location = searchParams.get('location') || 'Bangladesh';

    if (image && !isAllowedImageUrl(image)) {
      return new Response('Invalid image URL', { status: 400 });
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            backgroundImage: 'radial-gradient(circle at 25px 25px, #f1f5f9 2%, transparent 0%), radial-gradient(circle at 75px 75px, #f1f5f9 2%, transparent 0%)',
            backgroundSize: '100px 100px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              padding: '40px',
              gap: '40px',
            }}
          >
            {/* Image Section */}
            {image && (
              <div
                style={{
                  display: 'flex',
                  width: '400px',
                  height: '400px',
                  borderRadius: '32px',
                  overflow: 'hidden',
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt="Auction Preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
            )}

            {/* Content Section */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                gap: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '24px',
                  fontWeight: 600,
                  color: '#6366f1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Nilamit Auction
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '60px',
                  fontWeight: 800,
                  color: '#1e293b',
                  lineHeight: 1.1,
                  wordBreak: 'break-word',
                }}
              >
                {title.length > 50 ? title.substring(0, 47) + '...' : title}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: '48px',
                    fontWeight: 700,
                    color: '#6366f1',
                  }}
                >
                  à§³ {Number(price).toLocaleString()}
                </div>
                <div
                  style={{
                    display: 'flex',
                    background: '#f1f5f9',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    fontSize: '20px',
                    color: '#64748b',
                    fontWeight: 500,
                  }}
                >
                  ðŸ“ {location}
                </div>
              </div>
              
              <div
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div style={{ width: '40px', height: '40px', backgroundColor: '#6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ margin: 'auto' }}
                  >
                    <path d="m14.5 6.5 3 3" />
                    <path d="m18.5 10.5-9.4 9.4a2 2 0 0 1-2.8 0l-3.3-3.3a2 2 0 0 1 0-2.8l9.4-9.4" />
                    <path d="m13.4 7.6 3.6 3.6" />
                    <path d="m9.6 11.4 3.6 3.6" />
                    <path d="M5 21h14" />
                  </svg>
                </div>
                <div style={{ fontSize: '24px', color: '#475569', fontWeight: 600 }}>nilamit.com</div>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Noto Sans Bengali',
            data: fontData,
            style: 'normal',
          },
        ],
      }
    );
  } catch (e: unknown) {
    console.error('[OG] image generation failed:', e instanceof Error ? e.message : 'Unknown error');
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
