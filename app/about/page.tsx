import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About — CORTX',
  description: 'CORTX is end-to-end reliability monitoring for x402 payment APIs on Base mainnet.',
};

export default function AboutPage() {
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
            <Link href="/blog" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/signup" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '5px 12px', borderRadius: 6 }}>
              Get started
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 120px' }}>

        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>About</p>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 20, lineHeight: 1.2 }}>
          We build reliability infrastructure for the x402 ecosystem.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 48, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 48 }}>
          CORTX runs synthetic end-to-end payment checks against live x402 endpoints on Base mainnet — real USDC, real payments, on a schedule you control. When something breaks at any stage of the payment pipeline, you know before your users do.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: 10 }}>What we do</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
              x402 has seven distinct failure modes — from a malformed 402 response to a schema regression in the returned JSON. Standard uptime monitoring catches one of them. CORTX runs the full payment journey: probe, parse, validate price, sign and submit payment, confirm delivery, parse and validate the response body. Evidence at every stage, incidents on two consecutive failures, Telegram alerts with the exact failure point.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: 10 }}>Why mainnet</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
              Testnet monitoring has a critical blind spot: production failures that only appear on mainnet. Contract deployments differ, USDC addresses differ, EIP-712 domain configuration can be correct on testnet and wrong in production. The only way to know your mainnet endpoint works is to test your mainnet endpoint. CORTX uses real USDC on Base mainnet by design. The cost is fractions of a cent per check on most endpoints.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: 10 }}>Where we are</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
              CORTX is in private beta. We currently support Bankr-hosted x402 JSON APIs on Base mainnet. If you&apos;re building on x402 and want early access,{' '}
              <Link href="/signup" style={{ color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: 3 }}>request access</Link>
              {' '}— onboarding takes under five minutes.
            </p>
          </div>

        </div>

        {/* Contact / social */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 56, paddingTop: 40, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Find us on{' '}
            <a href="https://x.com/usecortx" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>X @usecortx</a>
            {', join the '}
            <a href="https://discord.gg/TKUgsqRqTg" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Discord</a>
            {', or in the '}
            <a href="https://t.me/usecortxdev" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Telegram developer channel</a>.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Website:{' '}
            <a href="https://usecortx.dev" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>usecortx.dev</a>
          </p>
        </div>
      </div>
    </div>
  );
}
