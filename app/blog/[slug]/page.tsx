import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ALL_POSTS } from '@/content/blog';

export async function generateStaticParams() {
  return ALL_POSTS.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = ALL_POSTS.find(p => p.slug === slug);
  if (!post) return {};
  return {
    title: `${post.title} — CORTX`,
    description: post.excerpt,
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = ALL_POSTS.find(p => p.slug === slug);
  if (!post) notFound();

  const { default: PostContent } = await import(`@/content/blog/${slug}`);

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

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '52px 24px 120px' }}>

        {/* Back link */}
        <Link href="/blog" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 40 }}>
          ← Blog
        </Link>

        {/* Post header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}>
              {formatDate(post.date)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>·</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{post.readTime}</span>
          </div>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: 20 }}>
            {post.title}
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 32 }}>
            {post.excerpt}
          </p>
        </div>

        {/* Post body */}
        <div style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'var(--text-secondary)',
        }}>
          <style>{`
            .post-body p { margin: 0 0 20px; }
            .post-body h2 { font-size: 18px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.02em; margin: 40px 0 14px; line-height: 1.35; }
            .post-body h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 28px 0 10px; }
            .post-body ol, .post-body ul { padding-left: 24px; margin: 0 0 20px; }
            .post-body li { margin-bottom: 10px; line-height: 1.75; }
            .post-body strong { color: var(--text-primary); font-weight: 600; }
            .post-body a { color: var(--text-primary); text-decoration: underline; text-underline-offset: 3px; }
            .post-body a:hover { color: var(--text-secondary); }
            .post-body code { font-family: var(--font-geist-mono); font-size: 13px; background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 2px 6px; border-radius: 4px; color: var(--text-primary); }
          `}</style>
          <div className="post-body">
            <PostContent />
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 64, paddingTop: 40 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Building on x402? Follow us on{' '}
            <a href="https://x.com/usecortx" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>X</a>
            {', join the '}
            <a href="https://discord.gg/TKUgsqRqTg" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Discord</a>
            {', or the '}
            <a href="https://t.me/usecortxdev" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Telegram</a>
            {' '}for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
