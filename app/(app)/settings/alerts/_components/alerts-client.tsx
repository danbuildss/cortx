'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type AlertConfig = {
  id: string;
  service_id: string;
  destination: string;
  enabled: boolean;
  on_open: boolean;
  on_severity_increase: boolean;
  on_resolve: boolean;
};

type Service = {
  id: string;
  name: string;
};

type Props = {
  services: Service[];
  configs: AlertConfig[];
  userId: string;
};

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', background: '#1a1a1a',
  border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 13,
  color: '#f0f0f0', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--font-geist-mono)',
};

export function AlertsClient({ services, configs: initialConfigs, userId }: Props) {
  const supabase = createClient();
  const [configs, setConfigs] = useState<AlertConfig[]>(initialConfigs);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newChatId, setNewChatId] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const configsByService = new Map<string, AlertConfig[]>();
  for (const cfg of configs) {
    const list = configsByService.get(cfg.service_id) ?? [];
    list.push(cfg);
    configsByService.set(cfg.service_id, list);
  }

  async function addConfig(serviceId: string) {
    if (!newChatId.trim()) return;
    setSaving('new-' + serviceId);
    setError('');

    const { data, error: err } = await supabase
      .from('alert_configs')
      .insert({
        service_id: serviceId,
        user_id: userId,
        channel: 'telegram',
        destination: newChatId.trim(),
        enabled: true,
        on_open: true,
        on_severity_increase: true,
        on_resolve: true,
      })
      .select('id, service_id, destination, enabled, on_open, on_severity_increase, on_resolve')
      .single();

    setSaving(null);
    if (err || !data) { setError(err?.message ?? 'Failed to add alert'); return; }
    setConfigs(prev => [...prev, data]);
    setAddingFor(null);
    setNewChatId('');
  }

  async function toggleField(configId: string, field: keyof AlertConfig, value: boolean) {
    setSaving(configId + ':' + field);
    await supabase.from('alert_configs').update({ [field]: value }).eq('id', configId);
    setConfigs(prev => prev.map(c => c.id === configId ? { ...c, [field]: value } : c));
    setSaving(null);
  }

  async function deleteConfig(configId: string) {
    setSaving('del-' + configId);
    await supabase.from('alert_configs').delete().eq('id', configId);
    setConfigs(prev => prev.filter(c => c.id !== configId));
    setSaving(null);
  }

  if (services.length === 0) {
    return (
      <div style={{
        background: '#111', border: '1px solid #1f1f1f', borderRadius: 8,
        padding: '32px 24px', textAlign: 'center', color: '#555', fontSize: 13,
      }}>
        No services yet. Add a service first.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {error && (
        <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{error}</p>
      )}

      {services.map((svc, i) => {
        const svcConfigs = configsByService.get(svc.id) ?? [];
        const isFirst = i === 0;
        const isLast = i === services.length - 1;

        return (
          <div key={svc.id} style={{
            background: '#111', border: '1px solid #1a1a1a',
            borderTopLeftRadius: isFirst ? 8 : 0,
            borderTopRightRadius: isFirst ? 8 : 0,
            borderBottomLeftRadius: isLast && addingFor !== svc.id ? 8 : 0,
            borderBottomRightRadius: isLast && addingFor !== svc.id ? 8 : 0,
            padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: svcConfigs.length > 0 || addingFor === svc.id ? 16 : 0 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f0' }}>{svc.name}</span>
              {addingFor !== svc.id && (
                <button
                  onClick={() => { setAddingFor(svc.id); setNewChatId(''); setError(''); }}
                  style={{
                    padding: '4px 12px', background: 'transparent',
                    border: '1px solid #2a2a2a', borderRadius: 5,
                    fontSize: 12, color: '#888', cursor: 'pointer',
                  }}
                >
                  + Add alert
                </button>
              )}
            </div>

            {/* Existing configs */}
            {svcConfigs.map(cfg => (
              <div key={cfg.id} style={{
                background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 7,
                padding: '12px 14px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#555' }}>Telegram</span>
                    <span style={{ fontSize: 12, color: '#888', fontFamily: 'var(--font-geist-mono)' }}>
                      {cfg.destination}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Toggle
                      label="Enabled"
                      checked={cfg.enabled}
                      loading={saving === cfg.id + ':enabled'}
                      onChange={v => toggleField(cfg.id, 'enabled', v)}
                      accent
                    />
                    <button
                      onClick={() => deleteConfig(cfg.id)}
                      disabled={saving === 'del-' + cfg.id}
                      style={{
                        padding: '3px 8px', background: 'transparent',
                        border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4,
                        fontSize: 11, color: '#ef4444', cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                  <Toggle
                    label="On open"
                    checked={cfg.on_open}
                    loading={saving === cfg.id + ':on_open'}
                    onChange={v => toggleField(cfg.id, 'on_open', v)}
                  />
                  <Toggle
                    label="On escalate"
                    checked={cfg.on_severity_increase}
                    loading={saving === cfg.id + ':on_severity_increase'}
                    onChange={v => toggleField(cfg.id, 'on_severity_increase', v)}
                  />
                  <Toggle
                    label="On resolve"
                    checked={cfg.on_resolve}
                    loading={saving === cfg.id + ':on_resolve'}
                    onChange={v => toggleField(cfg.id, 'on_resolve', v)}
                  />
                </div>
              </div>
            ))}

            {/* Add form */}
            {addingFor === svc.id && (
              <div style={{
                background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 7,
                padding: '12px 14px',
              }}>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>
                  Telegram chat ID
                  <span style={{ marginLeft: 6, color: '#444' }}>e.g. -1001234567890 or your personal ID</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={newChatId}
                    onChange={e => setNewChatId(e.target.value)}
                    placeholder="-1001234567890"
                    style={{ ...inp, flex: 1 }}
                    onKeyDown={e => { if (e.key === 'Enter') addConfig(svc.id); if (e.key === 'Escape') setAddingFor(null); }}
                    autoFocus
                  />
                  <button
                    onClick={() => addConfig(svc.id)}
                    disabled={saving === 'new-' + svc.id || !newChatId.trim()}
                    style={{
                      padding: '7px 14px', background: '#fff', color: '#000',
                      border: 'none', borderRadius: 6, fontSize: 12,
                      fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {saving === 'new-' + svc.id ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setAddingFor(null)}
                    style={{
                      padding: '7px 14px', background: 'transparent', color: '#555',
                      border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 12,
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Bot setup instructions */}
      <div style={{
        marginTop: 24, background: '#0d0d0d', border: '1px solid #1a1a1a',
        borderRadius: 8, padding: '16px 20px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 8 }}>
          How to get your Telegram chat ID
        </div>
        <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            'Start a chat with your bot (or add it to a group)',
            'Send a message to the bot',
            <>Message <span style={{ fontFamily: 'var(--font-geist-mono)', color: '#888' }}>@userinfobot</span> — it replies with your chat ID</>,
            'For groups: add @userinfobot to the group and send any message',
          ].map((step, i) => (
            <li key={i} style={{ fontSize: 12, color: '#555' }}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Toggle({
  label, checked, onChange, loading, accent,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={() => !loading && onChange(!checked)}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'transparent', border: 'none',
        cursor: loading ? 'wait' : 'pointer', padding: 0,
      }}
    >
      <span style={{
        display: 'inline-block', width: accent ? 28 : 24, height: accent ? 16 : 14,
        borderRadius: 99, background: checked ? (accent ? '#22c55e' : '#3b82f6') : '#2a2a2a',
        position: 'relative', transition: 'background 0.15s', flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute',
          top: accent ? 2 : 2,
          left: checked ? (accent ? 14 : 12) : 2,
          width: accent ? 12 : 10, height: accent ? 12 : 10,
          background: '#fff', borderRadius: '50%',
          transition: 'left 0.15s',
        }} />
      </span>
      <span style={{ fontSize: 11, color: '#666' }}>{label}</span>
    </button>
  );
}
