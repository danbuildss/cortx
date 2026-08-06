export default function AlertSettingsLoading() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ height: 24, width: 140, borderRadius: 4, background: 'var(--bg-elevated)', marginBottom: 8 }} />
        <div style={{ height: 14, width: 340, borderRadius: 3, background: 'var(--bg-elevated)' }} />
      </div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-elevated)', margin: '0 auto 16px' }} />
        <div style={{ height: 16, width: 160, borderRadius: 4, background: 'var(--bg-elevated)', margin: '0 auto 10px' }} />
        <div style={{ height: 13, width: 300, borderRadius: 3, background: 'var(--bg-elevated)', margin: '0 auto 24px' }} />
        <div style={{ height: 36, width: 160, borderRadius: 6, background: 'var(--bg-elevated)', margin: '0 auto' }} />
      </div>
    </div>
  );
}
