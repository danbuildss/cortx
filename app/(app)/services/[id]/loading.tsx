export default function ServiceDetailLoading() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ height: 14, width: 80, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 20 }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ height: 24, width: 200, borderRadius: 4, background: 'var(--bg-elevated)', marginBottom: 8 }} />
          <div style={{ height: 12, width: 280, borderRadius: 3, background: 'var(--bg-elevated)' }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ height: 30, width: 80, borderRadius: 6, background: 'var(--bg-elevated)' }} />
          <div style={{ height: 30, width: 80, borderRadius: 6, background: 'var(--bg-elevated)' }} />
          <div style={{ height: 30, width: 100, borderRadius: 6, background: 'var(--bg-elevated)' }} />
        </div>
      </div>

      {/* Meta cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ height: 11, width: 60, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 8 }} />
            <div style={{ height: 14, width: 100, borderRadius: 3, background: 'var(--bg-elevated)' }} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ height: 11, width: 100, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 12 }} />
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '16px 20px', height: 110 }} />
      </div>

      {/* Checks table */}
      <div style={{ height: 11, width: 110, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 12 }} />
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ borderBottom: '1px solid var(--border-mid)', padding: '10px 16px', display: 'flex', gap: 60 }}>
          {[80, 70, 70, 100].map((w, i) => (
            <div key={i} style={{ height: 11, width: w, borderRadius: 3, background: 'var(--bg-elevated)' }} />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none', padding: '14px 16px', display: 'flex', gap: 60, alignItems: 'center' }}>
            <div style={{ height: 12, width: 140, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 60, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 60, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 100, borderRadius: 3, background: 'var(--bg-elevated)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
