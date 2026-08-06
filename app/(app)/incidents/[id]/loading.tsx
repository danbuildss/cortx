export default function IncidentDetailLoading() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ height: 14, width: 90, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 20 }} />

      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ height: 20, width: 70, borderRadius: 4, background: 'var(--bg-elevated)' }} />
          <div style={{ height: 20, width: 60, borderRadius: 4, background: 'var(--bg-elevated)' }} />
        </div>
        <div style={{ height: 24, width: 240, borderRadius: 4, background: 'var(--bg-elevated)', marginBottom: 8 }} />
        <div style={{ height: 12, width: 300, borderRadius: 3, background: 'var(--bg-elevated)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ height: 11, width: 60, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 8 }} />
            <div style={{ height: 14, width: 110, borderRadius: 3, background: 'var(--bg-elevated)' }} />
          </div>
        ))}
      </div>

      <div style={{ height: 11, width: 70, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 16 }} />

      <div style={{ paddingLeft: 24 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: i < 2 ? 24 : 0 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--bg-elevated)', flexShrink: 0, marginLeft: -21, marginTop: 2 }} />
            <div>
              <div style={{ height: 14, width: 120, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 6 }} />
              <div style={{ height: 12, width: 200, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
