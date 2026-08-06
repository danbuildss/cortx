export function CortxMark({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  const h = Math.round((size / 80) * 60);
  return (
    <svg width={size} height={h} viewBox="0 0 80 60" fill="none" aria-hidden="true">
      <circle cx="23" cy="30" r="18" stroke={color} strokeWidth="3" />
      <circle cx="57" cy="30" r="18" stroke={color} strokeWidth="3" />
      <line x1="7" y1="30" x2="33" y2="30" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M40 23 A7 7 0 0 1 40 37" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="30" r="5" fill={color} />
    </svg>
  );
}
