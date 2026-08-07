import Link from 'next/link';
import { ALL_POSTS } from '@/content/blog';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function BlogIndex() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>

      {/* Top bar */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '0 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: 'var(--text-primary)', textDecoration: 'none' }}>
            CORTX
          </Link>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <Link href="/docs" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Docs</Link>
            <Link href="/signup" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '5px 12px', borderRadius: 6 }}>
              Get started
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 120px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Blog</p>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.2 }}>
          From the CORTX team
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 56, lineHeight: 1.7 }}>
          Thoughts on x402 reliability, on-chain monitoring, and building for Base mainnet.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {ALL_POSTS.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{ textDecoration: 'none', display: 'block', padding: '24px 0', borderTop: '1px solid var(--border-subtle)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}>
                  {formatDate(post.date)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>·</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{post.readTime}</span>
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4, letterSpacing: '-0.01em' }}>
                {post.title}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                {post.excerpt}
              </p>
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                Read more →
              </div>
            </Link>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 48, marginTop: 48 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Building on x402? Follow us on{' '}
            <a href="https://x.com/usecortx" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>X</a>
            {' '}or join the{' '}
            <a href="https://t.me/usecortxdev" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Telegram</a>
            {' '}for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
