export function CortxMark({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  const h = Math.round((size / 74) * 54);
  return (
    <svg width={size} height={h} viewBox="0 0 74 54" fill="none" aria-hidden="true">
      <circle cx="20" cy="27" r="18" stroke={color} strokeWidth="3" />
      <circle cx="54" cy="27" r="18" stroke={color} strokeWidth="3" />
      <line x1="4" y1="27" x2="30" y2="27" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M37 20 A7 7 0 0 1 37 34" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="37" cy="27" r="5" fill={color} />
    </svg>
  );
}
