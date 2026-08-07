'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { RANGES } from './range-utils';
import type { Range } from './range-utils';

export type { Range };

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
