import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const POSTS: Record<string, { title: string; excerpt: string }> = {
  'why-x402-needs-end-to-end-monitoring': {
    title: 'Why x402 services need end-to-end monitoring, not just uptime checks',
    excerpt: 'A ping check tells you the server responded. It tells you nothing about whether your users can actually pay and receive value from your x402 API.',
  },
  'x402-failure-modes': {
    title: 'x402 has 7 failure modes. Standard monitoring catches one.',
    excerpt: 'An x402 API can look operational while silently failing your users at any of seven distinct stages.',
  },
  'x402-facilitators-arent-universal': {
    title: "x402 facilitators aren't universal — and that's the hidden failure mode nobody talks about",
    excerpt: 'We built payment readiness verification for x402 services and hit an HTTP 500 that changed how we think about the whole monitoring stack.',
  },
};

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') ?? '';
  const post = POSTS[slug];
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
              maxWidth: 960,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 20, color: '#777', lineHeight: 1.5, maxWidth: 860 }}>
            {excerpt}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ffffff' }}>CORTX</div>
          <div style={{ fontSize: 15, color: '#444' }}>usecortx.dev</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
