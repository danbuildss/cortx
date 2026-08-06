export default function IncidentsLoading() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ height: 24, width: 100, borderRadius: 4, background: 'var(--bg-elevated)', marginBottom: 8 }} />
        <div style={{ height: 14, width: 160, borderRadius: 3, background: 'var(--bg-elevated)' }} />
      </div>

      <div style={{ height: 11, width: 40, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 10 }} />
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden', marginBottom: 40 }}>
        <div style={{ borderBottom: '1px solid var(--border-mid)', padding: '10px 16px', display: 'flex', gap: 40 }}>
          {[4, 120, 70, 60, 100, 120, 80].map((w, i) => (
            <div key={i} style={{ height: 11, width: w, borderRadius: 3, background: 'var(--bg-elevated)' }} />
          ))}
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none', padding: '14px 16px', display: 'flex', gap: 40, alignItems: 'center' }}>
            <div style={{ width: 3, height: 20, borderRadius: 2, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 14, width: 120, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 18, width: 60, borderRadius: 4, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 60, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 100, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 120, borderRadius: 3, background: 'var(--bg-elevated)' }} />
            <div style={{ height: 12, width: 60, borderRadius: 3, background: 'var(--bg-elevated)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
