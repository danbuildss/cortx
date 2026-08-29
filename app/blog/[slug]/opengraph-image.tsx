import { ImageResponse } from 'next/og';
import { ALL_POSTS } from '@/content/blog';

export const alt = 'CORTX Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = ALL_POSTS.find(p => p.slug === slug);
  const title = post?.title ?? 'CORTX Blog';

  const interBold = await fetch(
    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff'
  ).then(r => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#0a0a0a',
          fontFamily: 'Inter',
        }}
      >
        {/* Top: tag */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: '#666',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            CORTX Blog
          </div>
        </div>

        {/* Middle: title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: title.length > 60 ? 42 : 52,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.2,
              letterSpacing: '-0.03em',
              maxWidth: 900,
            }}
          >
            {title}
          </div>
          {post?.excerpt && (
            <div
              style={{
                fontSize: 20,
                color: '#888',
                lineHeight: 1.5,
                maxWidth: 800,
              }}
            >
              {post.excerpt.length > 120 ? post.excerpt.slice(0, 120) + '…' : post.excerpt}
            </div>
          )}
        </div>

        {/* Bottom: wordmark + domain */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.04em',
            }}
          >
            CORTX
          </div>
          <div
            style={{
              fontSize: 15,
              color: '#555',
            }}
          >
            usecortx.dev
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Inter',
          data: interBold,
          style: 'normal',
          weight: 700,
        },
      ],
    }
  );
}
