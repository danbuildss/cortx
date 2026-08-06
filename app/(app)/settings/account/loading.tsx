export default function AccountSettingsLoading() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ height: 24, width: 100, borderRadius: 4, background: 'var(--bg-elevated)', marginBottom: 8 }} />
        <div style={{ height: 14, width: 260, borderRadius: 3, background: 'var(--bg-elevated)' }} />
      </div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-elevated)' }} />
          <div>
            <div style={{ height: 16, width: 140, borderRadius: 4, background: 'var(--bg-elevated)', marginBottom: 6 }} />
            <div style={{ height: 12, width: 180, borderRadius: 3, background: 'var(--bg-elevated)' }} />
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 20 }} />
        <div style={{ height: 12, width: 90, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 8 }} />
        <div style={{ height: 36, borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: 20 }} />
        <div style={{ height: 12, width: 60, borderRadius: 3, background: 'var(--bg-elevated)', marginBottom: 8 }} />
        <div style={{ height: 36, borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: 20 }} />
        <div style={{ height: 36, width: 120, borderRadius: 6, background: 'var(--bg-elevated)' }} />
      </div>
    </div>
  );
}
