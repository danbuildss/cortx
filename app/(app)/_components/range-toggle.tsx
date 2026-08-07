'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const RANGES = ['24h', '7d', '30d'] as const;
export type Range = typeof RANGES[number];

export function RangeToggle({ current }: { current: Range }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setRange(r: Range) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', r);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div style={{
      display: 'flex',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 6,
      padding: 2,
      gap: 2,
    }}>
      {RANGES.map(r => (
        <button
          key={r}
          onClick={() => setRange(r)}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: 'none',
            background: current === r ? 'var(--bg-elevated)' : 'transparent',
            color: current === r ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: current === r ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'var(--font-geist-mono)',
            letterSpacing: '0.03em',
            transition: 'background 0.1s, color 0.1s',
          }}
        >
          {r.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function parseRange(raw: string | undefined): Range {
  if (raw === '7d' || raw === '30d') return raw;
  return '24h';
}

export function rangeToMs(range: Range): number {
  if (range === '30d') return 30 * 86400000;
  if (range === '7d')  return  7 * 86400000;
  return 86400000;
}

export function rangeLabel(range: Range): string {
  if (range === '30d') return '30d';
  if (range === '7d')  return '7d';
  return '24h';
}
