export default function OverviewLoading() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ height: 24, width: 120, borderRadius: 4, background: 'var(--bg-elevated)', marginBottom: 8 }} />
          <div style={{ height: 14, width: 180, borderRadius: 4, background: 'var(--bg-elevated)' }} />
        </div>
        <div style={{ height: 34, width: 100, borderRadius: 6, background: 'var(--bg-elevated)' }} />
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ height: 11, width: 70, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 10 }} />
            <div style={{ height: 28, width: 40, borderRadius: 4, background: 'var(--bg-elevated)' }} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ borderBottom: '1px solid var(--border-mid)', padding: '10px 16px', display: 'flex', gap: 60 }}>
          {[100, 200, 80, 100, 70].map((w, i) => (
            <div key={i} style={{ height: 11, width: w, borderRadius: 3, background: 'var(--bg-elevated)' }} />
          ))}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none', padding: '14px 16px', display: 'flex', gap: 60, alignItems: 'center' }}>
            <div style={{ height: 14, width: 120, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 200, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 80, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 70, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 40, borderRadius: 3, background: 'var(--bg-elevated)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
