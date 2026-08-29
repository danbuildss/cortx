import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { BLOG_META } from '@/content/blog/meta';

export const runtime = 'edge';

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') ?? '';
  const post = BLOG_META.find(p => p.slug === slug);
  const title = post?.title ?? 'CORTX Blog';
  const excerpt = post?.excerpt ?? '';

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
        }}
      >
        <div style={{ display: 'flex', fontSize: 13, color: '#555', letterSpacing: '0.08em' }}>
          CORTX BLOG
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: title.length > 60 ? 34 : 40,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              maxWidth: 960,
            }}
          >
            {title}
          </div>
          {excerpt && (
            <div
              style={{
                fontSize: 20,
                color: '#777',
                lineHeight: 1.5,
                maxWidth: 860,
              }}
            >
              {excerpt.length > 130 ? excerpt.slice(0, 130) + '…' : excerpt}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.04em' }}>
            CORTX
          </div>
          <div style={{ fontSize: 15, color: '#444' }}>
            usecortx.dev
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
