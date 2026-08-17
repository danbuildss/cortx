'use client';

import { useEffect, useRef } from 'react';

type NodeState = 'idle' | 'checking' | 'pass' | 'fail';

interface Node {
  x: number; y: number;
  vx: number; vy: number;
  baseR: number;
  state: NodeState;
  stateAge: number;       // frames since last state change
  stateDur: number;       // frames this state lasts
  pulse: number;          // oscillation phase
}

interface Packet {
  from: number; to: number;
  t: number;              // progress 0→1
  speed: number;
  color: string;
}

const NODE_COUNT  = 13;
const EDGE_DIST   = 185;
const BASE_SPEED  = 0.28;
const MAX_ACTIVE  = 3;    // max simultaneous checks

function isDark(canvas: HTMLCanvasElement) {
  const el = canvas.closest('[data-theme]') as HTMLElement | null;
  const attr = el?.getAttribute('data-theme');
  if (attr === 'dark')  return true;
  if (attr === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function mkNode(w: number, h: number, m = 40): Node {
  const angle = Math.random() * Math.PI * 2;
  const spd   = BASE_SPEED * (0.4 + Math.random() * 0.6);
  return {
    x: m + Math.random() * (w - m * 2),
    y: m + Math.random() * (h - m * 2),
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    baseR:  3.5 + Math.random() * 3,
    state:  'idle',
    stateAge: 0,
    stateDur:  0,
    pulse: Math.random() * Math.PI * 2,
  };
}

export default function ParticleNetwork({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let nodes: Node[]   = [];
    let packets: Packet[] = [];
    let frame  = 0;
    let nextTrigger = 120 + Math.random() * 60;
    let mouse  = { x: -9999, y: -9999 };

    /* ── Resize ─────────────────────────────────────────────── */
    function resize() {
      const w = canvas.clientWidth  || 400;
      const h = canvas.clientHeight || 380;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
        if (nodes.length === 0) {
          nodes = Array.from({ length: NODE_COUNT }, () => mkNode(w, h));
        } else {
          nodes.forEach(n => {
            n.x = Math.min(Math.max(n.x, 30), w - 30);
            n.y = Math.min(Math.max(n.y, 30), h - 30);
          });
        }
      }
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    /* ── Mouse ───────────────────────────────────────────────── */
    function onMove(e: MouseEvent) {
      const r = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function onLeave() { mouse = { x: -9999, y: -9999 }; }
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    /* ── Check trigger ───────────────────────────────────────── */
    function triggerCheck() {
      const active = nodes.filter(n => n.state !== 'idle').length;
      if (active >= MAX_ACTIVE) return;
      const idle = nodes.filter(n => n.state === 'idle');
      if (!idle.length) return;
      const n = idle[Math.floor(Math.random() * idle.length)];
      n.state    = 'checking';
      n.stateAge = 0;
      n.stateDur = 55 + Math.floor(Math.random() * 25);

      // Fire a packet from this node towards nearest neighbour
      const idx = nodes.indexOf(n);
      let nearest = -1, nearDist = Infinity;
      nodes.forEach((o, i) => {
        if (i === idx) return;
        const d = Math.hypot(o.x - n.x, o.y - n.y);
        if (d < nearDist) { nearDist = d; nearest = i; }
      });
      if (nearest >= 0 && nearDist < EDGE_DIST) {
        packets.push({ from: idx, to: nearest, t: 0, speed: 0.018 + Math.random() * 0.008, color: '#f59e0b' });
      }
    }

    /* ── Draw ────────────────────────────────────────────────── */
    function draw() {
      const W = canvas.width;
      const H = canvas.height;
      const dark = isDark(canvas);

      ctx.clearRect(0, 0, W, H);

      /* ── edges ── */
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > EDGE_DIST) continue;
          const fade = 1 - dist / EDGE_DIST;
          const aActive = a.state !== 'idle', bActive = b.state !== 'idle';
          const active = aActive || bActive;
          const src = aActive ? a : bActive ? b : null;
          let alpha: number, r = 0, g = 0, bCh = 0;
          if (src) {
            switch (src.state) {
              case 'checking': r=245;g=158;bCh=11;  alpha = fade * 0.45; break;
              case 'pass':     r= 22;g=163;bCh=74;  alpha = fade * 0.4;  break;
              case 'fail':     r=220;g= 38;bCh=38;  alpha = fade * 0.4;  break;
              default:         r= 94;g=106;bCh=210; alpha = fade * 0.25; break;
            }
          } else {
            r=94;g=106;bCh=210; alpha = dark ? fade*0.1 : fade*0.08;
          }
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${r},${g},${bCh},${alpha})`;
          ctx.lineWidth = active ? 1 : 0.7;
          ctx.stroke();
        }
      }

      /* ── packets ── */
      packets = packets.filter(p => p.t <= 1);
      packets.forEach(p => {
        const a = nodes[p.from], b = nodes[p.to];
        if (!a || !b) return;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const fade = Math.sin(p.t * Math.PI);
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(fade * 255).toString(16).padStart(2, '0');
        ctx.fill();
        // glow
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(fade * 60).toString(16).padStart(2, '0');
        ctx.fill();
        p.t += p.speed;
      });

      /* ── nodes ── */
      nodes.forEach((n, idx) => {
        n.pulse    += 0.045;
        n.stateAge += 1;

        /* state transitions */
        if (n.state === 'checking' && n.stateAge >= n.stateDur) {
          if (Math.random() < 0.22) {
            n.state = 'fail';
            // pulse ring packet
            packets.push({ from: idx, to: idx, t: 0, speed: 0.03, color: '#dc2626' });
          } else {
            n.state = 'pass';
            // success packet back
            nodes.forEach((o, oi) => {
              if (oi === idx) return;
              const d = Math.hypot(o.x - n.x, o.y - n.y);
              if (d < EDGE_DIST) packets.push({ from: idx, to: oi, t: 0, speed: 0.025, color: '#16a34a' });
            });
          }
          n.stateAge = 0;
          n.stateDur = n.state === 'fail' ? 130 + Math.floor(Math.random() * 60) : 38 + Math.floor(Math.random() * 18);
        } else if ((n.state === 'pass' || n.state === 'fail') && n.stateAge >= n.stateDur) {
          n.state = 'idle'; n.stateAge = 0;
        }

        /* mouse repulsion */
        const mdx = n.x - mouse.x, mdy = n.y - mouse.y;
        const md  = Math.hypot(mdx, mdy);
        if (md < 120 && md > 0) {
          const f = (1 - md / 120) * 0.35;
          n.vx += (mdx / md) * f;
          n.vy += (mdy / md) * f;
        }

        /* speed cap + drift */
        const spd = Math.hypot(n.vx, n.vy);
        const cap = BASE_SPEED * 2;
        if (spd > cap) { n.vx = (n.vx/spd)*cap; n.vy = (n.vy/spd)*cap; }
        n.vx *= 0.992; n.vy *= 0.992;
        if (spd < BASE_SPEED * 0.3) {
          n.vx += (Math.random() - 0.5) * 0.025;
          n.vy += (Math.random() - 0.5) * 0.025;
        }

        /* move + bounce */
        n.x += n.vx; n.y += n.vy;
        const m = 30;
        if (n.x < m)     { n.x = m;     n.vx =  Math.abs(n.vx); }
        if (n.x > W - m) { n.x = W - m; n.vx = -Math.abs(n.vx); }
        if (n.y < m)     { n.y = m;     n.vy =  Math.abs(n.vy); }
        if (n.y > H - m) { n.y = H - m; n.vy = -Math.abs(n.vy); }

        /* draw */
        let r = n.baseR, fill = '', stroke = '', sw = 1;
        switch (n.state) {
          case 'idle':
            fill   = dark ? 'rgba(124,140,248,0.12)' : 'rgba(94,106,210,0.1)';
            stroke = dark ? 'rgba(124,140,248,0.5)'  : 'rgba(94,106,210,0.45)';
            break;
          case 'checking':
            r      = n.baseR + Math.sin(n.pulse * 4) * 1.5;
            fill   = 'rgba(245,158,11,0.15)';
            stroke = '#f59e0b'; sw = 1.5;
            /* outer ring */
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 7 + Math.sin(n.pulse * 2) * 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(245,158,11,${0.18 + Math.sin(n.pulse * 3) * 0.08})`;
            ctx.lineWidth = 0.75; ctx.stroke();
            break;
          case 'pass':
            fill   = 'rgba(22,163,74,0.18)';
            stroke = '#16a34a'; sw = 1.5;
            break;
          case 'fail':
            r      = n.baseR + Math.sin(n.pulse * 5) * 1;
            fill   = 'rgba(220,38,38,0.15)';
            stroke = '#dc2626'; sw = 1.5;
            /* expanding fade ring */
            const rings = Math.min(n.stateAge, 60);
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 6 + rings * 0.12, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(220,38,38,${Math.max(0, 0.35 - rings * 0.006)})`;
            ctx.lineWidth = 0.75; ctx.stroke();
            break;
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke();

        /* centre dot */
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = stroke; ctx.fill();
      });
    }

    /* ── Loop ────────────────────────────────────────────────── */
    function tick() {
      frame++;
      if (frame >= nextTrigger) {
        triggerCheck();
        nextTrigger = frame + 150 + Math.floor(Math.random() * 100);
      }
      draw();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  );
}
