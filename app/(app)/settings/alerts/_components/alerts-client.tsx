'use client';

import { useState, useEffect, useRef } from 'react';

type Connection = {
  chat_id: string;
  username: string | null;
  connected_at: string;
  active: boolean;
  on_open: boolean;
  on_severity_increase: boolean;
  on_resolve: boolean;
};

export function TelegramConnect({ initialConnection }: { initialConnection: Connection | null }) {
  const [connection, setConnection] = useState<Connection | null>(initialConnection);
  const [connecting, setConnecting] = useState(false);
  const [waitingForBot, setWaitingForBot] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [error, setError] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function startConnect() {
    setError('');
    setConnecting(true);
    // Open the window synchronously before any await so browsers don't block it as a popup
    const win = window.open('', '_blank');
    try {
      const res = await fetch('/api/telegram/connect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        win?.close();
        throw new Error(data.error ?? 'Failed to generate link');
      }

      if (win) {
        win.location.href = data.deepLinkUrl;
      } else {
        window.location.href = data.deepLinkUrl;
      }
      setConnecting(false);
      setWaitingForBot(true);

      // Poll for connection
      pollRef.current = setInterval(async () => {
        const r = await fetch('/api/telegram/status');
        const d = await r.json();
        if (d.connected && d.connection) {
          setConnection(d.connection);
          setWaitingForBot(false);
          if (pollRef.current) clearInterval(pollRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
      }, 3000);

      // Stop polling after 10 minutes (token expiry)
      timeoutRef.current = setTimeout(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        setWaitingForBot(false);
        setError('Link expired. Generate a new one to try again.');
      }, 10 * 60 * 1000);
    } catch (e) {
      setConnecting(false);
      setError(e instanceof Error ? e.message : 'Failed to connect');
    }
  }

  function cancelConnect() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setWaitingForBot(false);
    setConnecting(false);
    setError('');
  }

  async function sendTest() {
    setTesting(true);
    setTestMsg('');
    const res = await fetch('/api/telegram/test', { method: 'POST' });
    setTesting(false);
    if (res.ok) {
      setTestMsg('Sent! Check your Telegram.');
      setTimeout(() => setTestMsg(''), 4000);
    } else {
      setTestMsg('Failed to send test alert.');
    }
  }

  async function disconnect() {
    await fetch('/api/telegram/disconnect', { method: 'DELETE' });
    setConnection(null);
    setTestMsg('');
    setConfirmDisconnect(false);
  }

  async function toggleEvent(field: 'on_open' | 'on_severity_increase' | 'on_resolve') {
    if (!connection) return;
    const newVal = !connection[field];
    setConnection(c => c ? { ...c, [field]: newVal } : c);
    await fetch('/api/telegram/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newVal }),
    });
  }

  if (connection) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Connected card */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
          borderRadius: 8, padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Green connected indicator */}
              <div style={{ position: 'relative', width: 36, height: 36 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--status-operational-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>
                  ✈
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 11, height: 11, borderRadius: '50%',
                  background: 'var(--status-operational)',
                  border: '2px solid var(--bg-surface)',
                }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Telegram connected
                </div>
                {connection.username && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    @{connection.username}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={sendTest}
                disabled={testing}
                style={{
                  padding: '6px 14px', background: 'transparent',
                  border: '1px solid var(--border-default)', borderRadius: 6,
                  fontSize: 12, color: testing ? 'var(--text-muted)' : 'var(--text-secondary)',
                  cursor: testing ? 'wait' : 'pointer',
                }}
              >
                {testing ? 'Sending…' : 'Test alert'}
              </button>
              {confirmDisconnect ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Disconnect?</span>
                  <button
                    onClick={disconnect}
                    style={{
                      padding: '5px 12px', background: 'var(--status-critical)',
                      border: 'none', borderRadius: 6,
                      fontSize: 12, color: '#fff', cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDisconnect(false)}
                    style={{
                      padding: '5px 12px', background: 'transparent',
                      border: '1px solid var(--border-default)', borderRadius: 6,
                      fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDisconnect(true)}
                  style={{
                    padding: '6px 14px', background: 'transparent',
                    border: '1px solid var(--status-critical-border)', borderRadius: 6,
                    fontSize: 12, color: 'var(--status-critical)', cursor: 'pointer',
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {testMsg && (
            <p style={{ fontSize: 12, color: testMsg.startsWith('Failed') ? 'var(--status-critical)' : 'var(--status-operational)', marginBottom: 16 }}>
              {testMsg}
            </p>
          )}

          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 16 }} />

          {/* Connection meta */}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Connected {new Date(connection.connected_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            {' '}· Chat ID <span style={{ fontFamily: 'var(--font-geist-mono)' }}>{connection.chat_id}</span>
          </div>

          {/* Event toggles */}
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Alert me when
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <EventToggle
              label="Incident opened"
              hint="A service starts failing checks"
              checked={connection.on_open}
              onChange={() => toggleEvent('on_open')}
            />
            <EventToggle
              label="Severity escalated"
              hint="Degraded incident escalates to critical"
              checked={connection.on_severity_increase}
              onChange={() => toggleEvent('on_severity_increase')}
            />
            <EventToggle
              label="Incident resolved"
              hint="Service recovers and checks pass again"
              checked={connection.on_resolve}
              onChange={() => toggleEvent('on_resolve')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Disconnected card */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
        borderRadius: 8, padding: '28px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, margin: '0 auto 16px',
        }}>
          ✈
        </div>

        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
          Connect Telegram
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
          Receive incident alerts directly in Telegram. One connection covers all your monitored services.
        </p>

        {waitingForBot ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Waiting for you to press <strong>Start</strong> in Telegram…
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--text-muted)',
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
            <button
              onClick={cancelConnect}
              style={{
                padding: '6px 14px', background: 'transparent',
                border: '1px solid var(--border-default)', borderRadius: 6,
                fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={startConnect}
            disabled={connecting}
            style={{
              padding: '9px 20px',
              background: connecting ? 'var(--border-default)' : 'var(--text-primary)',
              color: 'var(--bg-page)',
              border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 500,
              cursor: connecting ? 'not-allowed' : 'pointer',
            }}
          >
            {connecting ? 'Opening Telegram…' : 'Connect Telegram'}
          </button>
        )}

        {error && (
          <p style={{ fontSize: 12, color: 'var(--status-critical)', marginTop: 12 }}>{error}</p>
        )}
      </div>

      {/* How it works */}
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        borderRadius: 8, padding: '16px 20px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          How it works
        </div>
        <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            'Click "Connect Telegram" — a secure link opens the CORTX bot',
            'Press Start in Telegram',
            'Your account is connected automatically',
          ].map((step, i) => (
            <li key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>{step}</li>
          ))}
        </ol>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function EventToggle({
  label, hint, checked, onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 7, cursor: 'pointer',
      }}
      onClick={onChange}
    >
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 400 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{hint}</div>
      </div>
      <ToggleSwitch checked={checked} />
    </div>
  );
}

function ToggleSwitch({ checked }: { checked: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 32, height: 18,
      borderRadius: 99,
      background: checked ? 'var(--status-operational)' : 'var(--border-default)',
      position: 'relative', transition: 'background 0.15s', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute',
        top: 3, left: checked ? 17 : 3,
        width: 12, height: 12,
        background: '#fff', borderRadius: '50%',
        transition: 'left 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }} />
    </span>
  );
}
