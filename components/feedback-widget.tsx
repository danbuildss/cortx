'use client';

import { useState, useRef, useEffect } from 'react';

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [open]);

  async function submit() {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: '', problem: message.trim() }),
      });
      setStatus(res.ok ? 'sent' : 'error');
      if (res.ok) {
        setMessage('');
        setTimeout(() => { setStatus('idle'); setOpen(false); }, 2000);
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Send feedback"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-mid)',
          borderRadius: 99,
          fontSize: 13, fontWeight: 500,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
          transition: 'border-color 0.1s, color 0.1s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-mid)'; }}
      >
        <span style={{ fontSize: 14 }}>💬</span>
        Feedback
      </button>

      {open && (
        <div ref={panelRef} style={{
          position: 'fixed', bottom: 72, right: 24, zIndex: 1001,
          width: 300,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-mid)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Feedback</div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
          </div>

          {status === 'sent' ? (
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Thanks!</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Got it.</div>
            </div>
          ) : (
            <div style={{ padding: '14px 20px 20px' }}>
              <textarea
                autoFocus
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Something broken? Idea? Tell us."
                rows={4}
                className="app-input"
                style={{ resize: 'none', fontSize: 13, marginBottom: 12 }}
              />
              {status === 'error' && (
                <p style={{ fontSize: 12, color: 'var(--status-critical)', marginBottom: 10 }}>Failed to send — try again.</p>
              )}
              <button
                onClick={submit}
                disabled={status === 'sending' || !message.trim()}
                style={{
                  width: '100%', padding: '9px 16px',
                  background: (status === 'sending' || !message.trim()) ? 'var(--border-default)' : 'var(--text-primary)',
                  color: 'var(--bg-page)',
                  border: 'none', borderRadius: 6,
                  fontSize: 13, fontWeight: 500,
                  cursor: (status === 'sending' || !message.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {status === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
