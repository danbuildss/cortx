'use client';

import { useState } from 'react';

const CATEGORIES = ['AI / Inference', 'Data / Search', 'Media / Generation', 'Finance / Payments', 'Developer Tools', 'Other'];

type State = 'idle' | 'loading' | 'success' | 'error';

export function SubmitEndpointModal() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    endpoint_url: '',
    name: '',
    description: '',
    category: '',
    x_handle: '',
    website_url: '',
    submitter_email: '',
  });

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? 'Submission failed');
        setState('error');
        return;
      }
      setState('success');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('error');
    }
  }

  function close() {
    setOpen(false);
    setState('idle');
    setErrorMsg('');
    setForm({ endpoint_url: '', name: '', description: '', category: '', x_handle: '', website_url: '', submitter_email: '' });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, padding: '9px 12px',
    fontSize: 13, color: '#f5f5f5',
    outline: 'none', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
    color: '#9ca3af', marginBottom: 6, display: 'block',
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 600,
          background: '#fff', color: '#000',
          border: 'none', borderRadius: 6,
          padding: '8px 16px', cursor: 'pointer',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
        Add endpoint
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* Modal */}
      {open && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', zIndex: 51,
          transform: 'translate(-50%, -50%)',
          width: 'min(520px, calc(100vw - 32px))',
          background: '#111', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: '28px 28px 24px',
          maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, marginBottom: 4 }}>Submit an endpoint</h2>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                Submissions are reviewed before appearing in the registry.
              </p>
            </div>
            <button
              onClick={close}
              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
            >
              ✕
            </button>
          </div>

          {state === 'success' ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Submitted for review</div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>
                If approved, your endpoint will appear in the registry within 24 hours.
              </div>
              <button onClick={close} style={{ ...inputStyle, width: 'auto', padding: '9px 24px', cursor: 'pointer', background: '#fff', color: '#000', border: 'none', fontWeight: 600 }}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Endpoint URL */}
              <div>
                <label style={labelStyle}>ENDPOINT URL <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  required type="url"
                  placeholder="https://api.example.com/generate"
                  value={form.endpoint_url}
                  onChange={e => set('endpoint_url', e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Name */}
              <div>
                <label style={labelStyle}>SERVICE NAME <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  required type="text"
                  placeholder="e.g. Example Image Generator"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>DESCRIPTION</label>
                <textarea
                  placeholder="What does this endpoint do? (1–2 sentences)"
                  rows={2}
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
                />
              </div>

              {/* Category */}
              <div>
                <label style={labelStyle}>CATEGORY</label>
                <select
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' }}
                >
                  <option value="">Select a category…</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* X handle + Website side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>X / TWITTER</label>
                  <input
                    type="text"
                    placeholder="@handle"
                    value={form.x_handle}
                    onChange={e => set('x_handle', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>WEBSITE / DOCS</label>
                  <input
                    type="url"
                    placeholder="https://…"
                    value={form.website_url}
                    onChange={e => set('website_url', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Contact email */}
              <div>
                <label style={labelStyle}>CONTACT EMAIL <span style={{ color: '#6b7280', fontWeight: 400 }}>(private — not shown publicly)</span></label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.submitter_email}
                  onChange={e => set('submitter_email', e.target.value)}
                  style={inputStyle}
                />
              </div>

              {state === 'error' && (
                <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 12px' }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={close} style={{ ...inputStyle, width: 'auto', padding: '9px 18px', cursor: 'pointer', background: 'transparent', color: '#9ca3af' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={state === 'loading'}
                  style={{
                    padding: '9px 22px', fontWeight: 600, fontSize: 13,
                    background: state === 'loading' ? '#374151' : '#fff',
                    color: state === 'loading' ? '#9ca3af' : '#000',
                    border: 'none', borderRadius: 6, cursor: state === 'loading' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {state === 'loading' ? 'Submitting…' : 'Submit for review'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
