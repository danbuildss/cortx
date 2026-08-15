'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RegistrySeedForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/registry-seeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), endpoint_url: url.trim(), description: desc.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setName(''); setUrl(''); setDesc(''); setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add seed');
    } finally {
      setLoading(false);
    }
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '7px 10px', fontSize: 12, borderRadius: 6,
    border: '1px solid var(--border-mid)', background: 'var(--bg-muted)',
    color: 'var(--text-primary)', outline: 'none',
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
          background: 'var(--bg-muted)', border: '1px solid var(--border-mid)',
          color: 'var(--text-secondary)',
        }}
      >
        + Add endpoint
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-muted)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Name *</label>
          <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Aeon Deep Research" required />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Endpoint URL *</label>
          <input style={input} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.example.com/query" required />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Description (optional)</label>
        <input style={input} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What this endpoint does" />
      </div>
      {error && <div style={{ fontSize: 11, color: 'var(--status-critical)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={loading || !name.trim() || !url.trim()}
          style={{
            fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: loading ? 'wait' : 'pointer',
            background: 'var(--text-primary)', color: 'var(--bg-page)', border: 'none',
            opacity: loading || !name.trim() || !url.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Adding…' : 'Add seed'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          style={{
            fontSize: 11, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border-mid)', color: 'var(--text-muted)',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
