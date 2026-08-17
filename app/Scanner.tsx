'use client';

import { useEffect, useRef } from 'react';

interface ScannerProps {
  color1?: string;
  color2?: string;
  color3?: string;
  speed?: number;
  sweepSpeed?: number;
  sweepWidth?: number;
  sweepFalloff?: number;
  scale?: number;
  frequency?: number;
  ripple?: number;
  bandDensity?: number;
  lineSharpness?: number;
  glow?: number;
  scanDirection?: 'vertical' | 'horizontal';
  colorSpread?: number;
  brightness?: number;
  contrast?: number;
  softness?: number;
  vignette?: number;
  scanline?: boolean;
  grain?: boolean;
  grainIntensity?: number;
  opacity?: number;
  mouseInteraction?: boolean;
  mouseRadius?: number;
  mouseStrength?: number;
  style?: React.CSSProperties;
  className?: string;
}

function hexToVec3(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
}

const VERT = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
  precision highp float;
  uniform vec2  u_res;
  uniform float u_time;
  uniform vec2  u_mouse;
  uniform vec3  u_c1;
  uniform vec3  u_c2;
  uniform vec3  u_c3;
  uniform float u_speed;
  uniform float u_sweepSpd;
  uniform float u_sweepW;
  uniform float u_sweepF;
  uniform float u_scale;
  uniform float u_freq;
  uniform float u_ripple;
  uniform float u_density;
  uniform float u_sharp;
  uniform float u_glow;
  uniform float u_spread;
  uniform float u_bright;
  uniform float u_contrast;
  uniform float u_soft;
  uniform float u_vign;
  uniform float u_scanline;
  uniform float u_grain;
  uniform float u_grainAmt;
  uniform float u_mRad;
  uniform float u_mStr;
  uniform float u_dir;   /* 0 = vertical bands, 1 = horizontal */

  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    uv.y = 1.0 - uv.y;

    /* Mouse distortion */
    vec2 muv = u_mouse / u_res;
    muv.y = 1.0 - muv.y;
    vec2 toM = uv - muv;
    float dM = length(toM);
    float mInfl = u_mStr * smoothstep(u_mRad, 0.0, dM);

    vec2 uvd = uv;
    if (dM > 0.001) {
      float wave = sin(dM * 28.0 - u_time * 4.5) * u_ripple * mInfl;
      uvd += normalize(toM) * wave * 0.045;
    }
    /* Ambient ripple */
    uvd.x += sin(uv.y * 9.0 * u_scale + u_time * u_speed * 1.4) * u_ripple * 0.014;
    uvd.y += cos(uv.x * 7.0 * u_scale + u_time * u_speed * 1.1) * u_ripple * 0.011;

    /* Pick the axis for bands */
    float sc = mix(uvd.x, uvd.y, u_dir);

    /* Band pattern */
    float phase  = sc * u_freq * u_scale + u_time * u_speed;
    float raw    = sin(phase * u_density * 3.14159265);
    float shp    = max(u_sharp, 0.01);
    float banded = sign(raw) * pow(abs(raw), 1.0 / shp);
    float ct     = banded * 0.5 + 0.5;

    /* Three-colour gradient */
    float sp = clamp(u_spread, 0.001, 0.999);
    vec3 col;
    if (ct < sp) {
      col = mix(u_c1, u_c2, ct / sp);
    } else {
      col = mix(u_c2, u_c3, (ct - sp) / (1.0 - sp));
    }

    /* Sweep line */
    float sPos  = mod(u_time * u_sweepSpd, 1.0 + u_sweepW) - u_sweepW * 0.5;
    float sDist = abs(sc - sPos);
    float sweep = exp(-sDist * u_sweepF) * u_glow;
    col += vec3(sweep);

    /* Brightness + contrast */
    col *= u_bright;
    col  = clamp((col - 0.5) * u_contrast + 0.5, 0.0, 1.0);

    /* Edge softness along scan axis */
    float es = max(u_soft * 0.08, 0.001);
    col *= smoothstep(0.0, es, sc) * smoothstep(0.0, es, 1.0 - sc);

    /* Vignette */
    vec2 vUV = uv * 2.0 - 1.0;
    float vig = clamp(1.0 - dot(vUV, vUV) * u_vign, 0.0, 1.0);
    col *= vig;

    /* Scanlines */
    if (u_scanline > 0.5) {
      col *= 0.97 + 0.03 * sin(gl_FragCoord.y * 3.14159265);
    }

    /* Film grain */
    if (u_grain > 0.5) {
      float g = rand(uv + vec2(fract(u_time * 7.31), fract(u_time * 4.17)));
      col += (g - 0.5) * u_grainAmt * 2.0;
    }

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export default function Scanner({
  color1 = '#5227FF',
  color2 = '#FF9FFC',
  color3 = '#FFFFFF',
  speed = 0.5,
  sweepSpeed = 0.25,
  sweepWidth = 1.6,
  sweepFalloff = 6,
  scale = 1.5,
  frequency = 2,
  ripple = 0.22,
  bandDensity = 11,
  lineSharpness = 5.5,
  glow = 0.22,
  scanDirection = 'vertical',
  colorSpread = 0.7,
  brightness = 1,
  contrast = 1.15,
  softness = 1.4,
  vignette = 0.45,
  scanline = false,
  grain = false,
  grainIntensity = 0.05,
  opacity = 1,
  mouseInteraction = false,
  mouseRadius = 0.5,
  mouseStrength = 0.5,
  style,
  className,
}: ScannerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const mouseRef  = useRef({ x: 0.5, y: 0.5 });
  const glRef     = useRef<{
    gl: WebGLRenderingContext;
    uniforms: Record<string, WebGLUniformLocation | null>;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;

    /* compile shader */
    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS))
        console.error('Scanner shader error:', gl!.getShaderInfoLog(s));
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    /* full-screen quad */
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    /* uniform locations */
    const names = [
      'u_res','u_time','u_mouse',
      'u_c1','u_c2','u_c3',
      'u_speed','u_sweepSpd','u_sweepW','u_sweepF',
      'u_scale','u_freq','u_ripple','u_density',
      'u_sharp','u_glow','u_spread',
      'u_bright','u_contrast','u_soft','u_vign',
      'u_scanline','u_grain','u_grainAmt',
      'u_mRad','u_mStr','u_dir',
    ];
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    names.forEach(n => { uniforms[n] = gl.getUniformLocation(prog, n); });
    glRef.current = { gl, uniforms };

    /* set static uniforms */
    const [r1,g1,b1] = hexToVec3(color1);
    const [r2,g2,b2] = hexToVec3(color2);
    const [r3,g3,b3] = hexToVec3(color3);
    gl.uniform3f(uniforms.u_c1, r1, g1, b1);
    gl.uniform3f(uniforms.u_c2, r2, g2, b2);
    gl.uniform3f(uniforms.u_c3, r3, g3, b3);
    gl.uniform1f(uniforms.u_speed,     speed);
    gl.uniform1f(uniforms.u_sweepSpd,  sweepSpeed);
    gl.uniform1f(uniforms.u_sweepW,    sweepWidth);
    gl.uniform1f(uniforms.u_sweepF,    sweepFalloff);
    gl.uniform1f(uniforms.u_scale,     scale);
    gl.uniform1f(uniforms.u_freq,      frequency);
    gl.uniform1f(uniforms.u_ripple,    ripple);
    gl.uniform1f(uniforms.u_density,   bandDensity);
    gl.uniform1f(uniforms.u_sharp,     lineSharpness);
    gl.uniform1f(uniforms.u_glow,      glow);
    gl.uniform1f(uniforms.u_spread,    colorSpread);
    gl.uniform1f(uniforms.u_bright,    brightness);
    gl.uniform1f(uniforms.u_contrast,  contrast);
    gl.uniform1f(uniforms.u_soft,      softness);
    gl.uniform1f(uniforms.u_vign,      vignette);
    gl.uniform1f(uniforms.u_scanline,  scanline ? 1 : 0);
    gl.uniform1f(uniforms.u_grain,     grain ? 1 : 0);
    gl.uniform1f(uniforms.u_grainAmt,  grainIntensity);
    gl.uniform1f(uniforms.u_mRad,      mouseRadius);
    gl.uniform1f(uniforms.u_mStr,      mouseInteraction ? mouseStrength : 0);
    gl.uniform1f(uniforms.u_dir,       scanDirection === 'horizontal' ? 1 : 0);

    /* resize */
    function resize() {
      if (!canvas) return;
      const w = canvas.clientWidth  || canvas.offsetWidth;
      const h = canvas.clientHeight || canvas.offsetHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
        gl!.viewport(0, 0, w, h);
        gl!.uniform2f(uniforms.u_res, w, h);
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /* mouse */
    function onMove(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    if (mouseInteraction) {
      canvas.addEventListener('mousemove', onMove);
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: r.width / 2, y: r.height / 2 };
    }

    /* animation loop */
    const t0 = performance.now();
    function frame() {
      const state = glRef.current;
      if (!state) return;
      const { gl: g, uniforms: u } = state;
      const t = (performance.now() - t0) / 1000;
      g.uniform1f(u.u_time,  t);
      g.uniform2f(u.u_mouse, mouseRef.current.x, mouseRef.current.y);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(frame);
    }
    frame();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      if (mouseInteraction) canvas.removeEventListener('mousemove', onMove);
      glRef.current = null;
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', opacity, ...style }}
    />
  );
}
