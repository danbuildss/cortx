export const RANGES = ['24h', '7d', '30d'] as const;
export type Range = typeof RANGES[number];

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
