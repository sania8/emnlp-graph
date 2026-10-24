"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- constants ---------- */
const FS = 2000, DUR = 12, N = FS * DUR, T_BEAT = 0.8;
const WIN = 256, HOP = 32, NFFT = 512, FMAX = 500, DB = 70; // demo STFT (see note in UI)
const LW = 720, LH = 420, PX = 44, PW = 660;
const STAGE_SECS = 9;

type Variant = "normal" | "abnormal";

const STAGES = [
  { title: "PCG recording", text: "A phonocardiogram (PCG) is the heart's sound as a waveform. Each beat has two main sounds: S1 (valves closing at the start of contraction) and S2 (at the end). In the abnormal example, a murmur fills the gap between them. The signal is synthetic, and the noise slider adds background noise like a real recording." },
  { title: "Low-pass filter", text: "The paper removes background noise with a low-pass filter at a 200 Hz cutoff. Watch the spectrum: everything to the right of the cutoff line is suppressed, while the heart sounds (mostly below 200 Hz) are kept. Try moving the cutoff." },
  { title: "STFT spectrogram", text: "A short window slides along the filtered signal. Each position is converted into a frequency spectrum (FFT), and the spectra are stacked into a time-frequency image, which is what an image classifier can read. The paper uses a 2,048-sample window, 512-sample hop and 2,048 FFT points; this demo uses a shorter window so single heart sounds are visible." },
  { title: "YOLOv8 classification", text: "The spectrogram image is passed to YOLOv8, which labels it normal or abnormal. This stage is a conceptual animation: no network runs in the browser, and the class shown is simply the example you selected." },
  { title: "Prediction and confidence", text: "In the paper's web app, the user uploads a .wav file, presses Predict, and sees the class with a confidence score. This panel imitates that flow with example values; it is not a model output or a medical result." },
] as const;

/* ---------- DSP ---------- */
function rng(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len / 2;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const a = i + k, b = a + h, vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi; re[a] += vr; im[a] += vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** Hann-windowed magnitude spectrum of x[start .. start+len), zero-padded to nfft. */
function spectrum(x: Float32Array, start: number, len: number, nfft: number) {
  const re = new Float64Array(nfft), im = new Float64Array(nfft);
  for (let i = 0; i < len; i++) re[i] = x[(((start + i) % N) + N) % N] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1)));
  fft(re, im);
  const out = new Float64Array(nfft / 2 + 1);
  for (let k = 0; k < out.length; k++) out[k] = (Math.hypot(re[k], im[k]) * 2) / len;
  return out;
}

/** 4th-order Butterworth low-pass as two cascaded biquads. */
function lowpass(x: Float32Array, fc: number) {
  let y = Float32Array.from(x);
  for (const Q of [0.5412, 1.3066]) {
    const w0 = (2 * Math.PI * fc) / FS, c = Math.cos(w0), al = Math.sin(w0) / (2 * Q), a0 = 1 + al;
    const b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, a1 = (-2 * c) / a0, a2 = (1 - al) / a0;
    const o = new Float32Array(y.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = b0 * y[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = y[i]; y2 = y1; y1 = v; o[i] = v;
    }
    y = o;
  }
  return y;
}

function synth(variant: Variant, noise: number, cutoff: number) {
  const r = rng(variant === "normal" ? 11 : 29), gauss = () => (r() + r() + r() + r() - 2) * 1.7;
  const clean = new Float32Array(N), beats: number[] = [];
  const burst = (t0: number, f: number, decay: number, amp: number) => {
    const s = Math.floor(t0 * FS);
    for (let i = 0; i < 0.2 * FS; i++) { const u = i / FS; clean[(s + i) % N] += amp * Math.exp(-decay * u) * (Math.sin(2 * Math.PI * f * u) + 0.5 * Math.sin(2 * Math.PI * f * 1.7 * u)); }
  };
  for (let b = 0; b < 15; b++) {
    const t0 = b * T_BEAT + 0.05 + (r() - 0.5) * 0.03; beats.push(t0);
    burst(t0, 52, 26, 1); burst(t0 + 0.33, 82, 32, 0.7);
    if (variant === "abnormal") { // systolic murmur between S1 and S2, 105-185 Hz
      const ms = Math.floor((t0 + 0.1) * FS), ml = Math.floor(0.2 * FS), ph = Array.from({ length: 6 }, () => r() * 6.28);
      for (let i = 0; i < ml; i++) { let v = 0; for (let k = 0; k < 6; k++) v += Math.sin((2 * Math.PI * (105 + k * 16) * i) / FS + ph[k]); clean[(ms + i) % N] += 0.1 * Math.sin((Math.PI * i) / ml) * v; }
    }
  }
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) raw[i] = clean[i] + noise * 0.3 * gauss() + noise * 0.12 * Math.sin((2 * Math.PI * 430 * i) / FS);
  const fil = lowpass(raw, cutoff);
  let mx = 0; for (let i = 0; i < N; i++) mx = Math.max(mx, Math.abs(raw[i]));

  // spectrogram of the filtered signal
  const cols = Math.floor((N - WIN) / HOP) + 1, rows = Math.round(FMAX / (FS / NFFT));
  const mag = new Float32Array(cols * rows); let ref = 1e-9;
  for (let c = 0; c < cols; c++) { const s = spectrum(fil, c * HOP, WIN, NFFT); for (let k = 0; k < rows; k++) { mag[c * rows + k] = s[k]; ref = Math.max(ref, s[k]); } }
  const v = new Float32Array(cols * rows);
  for (let i = 0; i < v.length; i++) v[i] = Math.min(1, Math.max(0, (20 * Math.log10(mag[i] / ref + 1e-9) + DB) / DB));
  let ref2 = 1e-9; for (let b = 0; b < 12; b++) { const s = spectrum(raw, b * FS, 1024, 1024); for (const m of s) ref2 = Math.max(ref2, m); }
  return { raw, fil, beats, scale: 0.9 / (mx * 1.05), cols, rows, v, ref, ref2 };
}
type Data = ReturnType<typeof synth>;

/* ---------- drawing helpers ---------- */
const STOPS = [[0, 0, 4], [60, 14, 98], [140, 40, 110], [221, 81, 58], [250, 170, 20], [252, 255, 164]];
function cmap(v: number) {
  const f = Math.min(0.9999, Math.max(0, v)) * (STOPS.length - 1), i = Math.floor(f), t = f - i;
  return STOPS[i].map((c, k) => Math.round(c + (STOPS[i + 1][k] - c) * t));
}
const FONT = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
const C = { bg: "#070b14", grid: "rgba(148,163,184,0.12)", txt: "#94a3b8", raw: "#60a5fa", fil: "#22d3ee", amber: "#fbbf24", red: "rgba(248,113,113,0.10)" };

function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color = C.txt, align: CanvasTextAlign = "left") {
  ctx.font = FONT; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
}
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#0b1220"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = C.grid; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}
function drawWave(ctx: CanvasRenderingContext2D, sig: Float32Array, tEnd: number, span: number, x: number, y: number, w: number, h: number, scale: number, color: string, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
  const spp = (span * FS) / w, mid = y + h / 2, n = Math.max(1, Math.ceil(spp));
  for (let px = 0; px < w; px++) {
    const s0 = Math.floor((tEnd - span) * FS + px * spp); let mn = 1e9, mx = -1e9;
    for (let k = 0; k < n; k++) { const v = sig[(((s0 + k) % N) + N) % N]; if (v < mn) mn = v; if (v > mx) mx = v; }
    ctx.moveTo(x + px + 0.5, mid - mx * scale * (h / 2)); ctx.lineTo(x + px + 0.5, mid - mn * scale * (h / 2) + (mx === mn ? 1 : 0));
  }
  ctx.stroke(); ctx.restore();
}
function timeGrid(ctx: CanvasRenderingContext2D, tEnd: number, span: number, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + h / 2 + 0.5); ctx.lineTo(x + w, y + h / 2 + 0.5); ctx.stroke();
  for (let tk = Math.ceil((tEnd - span) * 4) / 4; tk <= tEnd; tk += 0.25) {
    const px = x + ((tk - (tEnd - span)) / span) * w, major = Math.abs(tk - Math.round(tk)) < 1e-6;
    ctx.beginPath(); ctx.moveTo(px + 0.5, y); ctx.lineTo(px + 0.5, y + h); ctx.globalAlpha = major ? 1 : 0.45; ctx.stroke(); ctx.globalAlpha = 1;
    if (major) label(ctx, `${(((Math.round(tk) % DUR) + DUR) % DUR)}s`, px, y + h + 12, C.txt, "center");
  }
}
function markers(ctx: CanvasRenderingContext2D, d: Data, variant: Variant, tEnd: number, span: number, x: number, y: number, w: number, h: number) {
  const pos = (tm: number) => { const rel = ((((tm - (tEnd - span)) % DUR) + DUR) % DUR); return rel <= span ? x + (rel / span) * w : -1; };
  for (const tb of d.beats) {
    for (const [tm, name] of [[tb, "S1"], [tb + 0.33, "S2"]] as const) {
      const px = pos(tm); if (px < x + 10 || px > x + w - 10) continue;
      ctx.strokeStyle = "rgba(251,191,36,0.35)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px, y + 20); ctx.lineTo(px, y + h); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, name, px, y + 14, C.amber, "center");
    }
    if (variant === "abnormal") {
      const a = pos(tb + 0.1), b = pos(tb + 0.3);
      if (a > x && b > a && b < x + w) { ctx.strokeStyle = "#f59e0b"; ctx.beginPath(); ctx.moveTo(a, y + h - 10); ctx.lineTo(b, y + h - 10); ctx.stroke(); label(ctx, "murmur", (a + b) / 2, y + h - 14, "#f59e0b", "center"); }
    }
  }
}
function nowLine(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  const g = ctx.createLinearGradient(x - 24, 0, x, 0); g.addColorStop(0, "rgba(34,211,238,0)"); g.addColorStop(1, "rgba(34,211,238,0.22)");
  ctx.fillStyle = g; ctx.fillRect(x - 24, y, 24, h); ctx.fillStyle = C.fil; ctx.fillRect(x - 1, y, 2, h);
}
function specLine(ctx: CanvasRenderingContext2D, s: Float64Array, ref: number, range: number, maxBin: number, x: number, y: number, w: number, h: number, color: string, fill: boolean) {
  ctx.beginPath();
  for (let i = 0; i <= maxBin; i++) {
    const v = Math.min(1, Math.max(0, (20 * Math.log10(s[i] / ref + 1e-9) + range) / range)), px = x + (i / maxBin) * w, py = y + h - v * h;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  if (fill) { ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); }
}
function drawSpec(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, cols: number, shown: number, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#000"; ctx.fillRect(x, y, w, h);
  if (shown > 0) { ctx.imageSmoothingEnabled = true; ctx.drawImage(img, 0, 0, shown, img.height, x, y, (w * shown) / cols, h); }
  ctx.strokeStyle = C.grid; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  for (let f = 0; f <= 500; f += 100) label(ctx, `${f}`, x - 6, y + h - (f / FMAX) * h + 3, C.txt, "right");
  label(ctx, "Hz", x - 6, y - 4, C.txt, "right");
  for (let s = 0; s <= DUR; s += 2) label(ctx, `${s}s`, x + (s / DUR) * w, y + h + 12, C.txt, "center");
}

/* ---------- component ---------- */
export function HeartSoundLab() {
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [tour, setTour] = useState(true);
  const [variant, setVariant] = useState<Variant>("normal");
  const [noise, setNoise] = useState(0.5);
  const [cutoff, setCutoff] = useState(200);
  const [speed, setSpeed] = useState(1);
  const [predict, setPredict] = useState<"idle" | "running" | "done">("idle");

  const data = useMemo(() => synth(variant, noise, cutoff), [variant, noise, cutoff]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLCanvasElement | null>(null);
  const S = useRef({ t: 3, clock: 0, lastStage: -1, a: new Float64Array(513), b: new Float64Array(513) });
  const P = useRef({ stage, playing, tour, variant, cutoff, speed, data });
  P.current = { stage, playing, tour, variant, cutoff, speed, data };

  // build the spectrogram bitmap whenever the signal changes
  useEffect(() => {
    const c = document.createElement("canvas"); c.width = data.cols; c.height = data.rows;
    const g = c.getContext("2d")!, im = g.createImageData(data.cols, data.rows);
    for (let col = 0; col < data.cols; col++) for (let row = 0; row < data.rows; row++) {
      const [r, gg, b] = cmap(data.v[col * data.rows + row]), o = ((data.rows - 1 - row) * data.cols + col) * 4;
      im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = 255;
    }
    g.putImageData(im, 0, 0); imgRef.current = c;
  }, [data]);

  // simulated "Predict" flow in the app mock-up
  useEffect(() => {
    setPredict("idle");
    if (stage !== 4 || !playing) return;
    const a = window.setTimeout(() => setPredict("running"), 900), b = window.setTimeout(() => setPredict("done"), 2500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [stage, variant, playing]);
  const runPredict = () => { setPredict("running"); window.setTimeout(() => setPredict("done"), 1400); };

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    cv.width = LW * 2; cv.height = LH * 2;
    const ctx = cv.getContext("2d")!; ctx.setTransform(2, 0, 0, 2, 0, 0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPlaying(false); setTour(false); }
    let raf = 0, last = performance.now();

    const draw = (p: typeof P.current, st: typeof S.current) => {
      const d = p.data, t = st.t, c = st.clock;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, LW, LH);

      if (p.stage === 0) {
        label(ctx, "Raw recording (with background noise)", PX, 18, "#e2e8f0");
        const y = 30, h = 340; panel(ctx, PX, y, PW, h);
        timeGrid(ctx, t, 3, PX, y, PW, h);
        drawWave(ctx, d.raw, t, 3, PX, y, PW, h, d.scale, C.raw);
        markers(ctx, d, p.variant, t, 3, PX, y, PW, h); nowLine(ctx, PX + PW, y, h);
        label(ctx, "Time", PX + PW, y + h + 26, C.txt, "right"); label(ctx, "Amplitude", PX, y + h + 26);
      } else if (p.stage === 1) {
        label(ctx, "Before and after the low-pass filter", PX, 18, "#e2e8f0");
        label(ctx, "raw", PX + PW - 90, 18, C.raw, "right"); label(ctx, "filtered", PX + PW, 18, C.fil, "right");
        const y = 30, h = 180; panel(ctx, PX, y, PW, h); timeGrid(ctx, t, 2, PX, y, PW, h);
        drawWave(ctx, d.raw, t, 2, PX, y, PW, h, d.scale, C.raw, 0.45); drawWave(ctx, d.fil, t, 2, PX, y, PW, h, d.scale, C.fil);
        nowLine(ctx, PX + PW, y, h);
        const sy = 252, sh = 128, start = Math.floor(t * FS) - 1024;
        const a = spectrum(d.raw, start, 1024, 1024), b = spectrum(d.fil, start, 1024, 1024);
        for (let i = 0; i < a.length; i++) { st.a[i] = st.a[i] * 0.75 + a[i] * 0.25; st.b[i] = st.b[i] * 0.75 + b[i] * 0.25; }
        panel(ctx, PX, sy, PW, sh);
        const cx = PX + (p.cutoff / 1000) * PW; ctx.fillStyle = C.red; ctx.fillRect(cx, sy, PX + PW - cx, sh);
        specLine(ctx, st.a, d.ref2, 80, 512, PX, sy, PW, sh, "rgba(96,165,250,0.85)", false);
        specLine(ctx, st.b, d.ref2, 80, 512, PX, sy, PW, sh, "rgba(34,211,238,0.22)", true); specLine(ctx, st.b, d.ref2, 80, 512, PX, sy, PW, sh, C.fil, false);
        ctx.strokeStyle = C.amber; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(cx, sy); ctx.lineTo(cx, sy + sh); ctx.stroke(); ctx.setLineDash([]);
        label(ctx, `${p.cutoff} Hz cutoff`, cx + 6, sy + 12, C.amber);
        label(ctx, "Frequency spectrum of the last 0.5 s", PX, sy - 6, "#e2e8f0");
        for (let f = 0; f <= 1000; f += 200) label(ctx, `${f} Hz`, PX + (f / 1000) * PW, sy + sh + 12, C.txt, f === 0 ? "left" : f === 1000 ? "right" : "center");
      } else if (p.stage === 2) {
        const f0 = d.fil;
        label(ctx, "1. Window slides along the filtered signal", PX, 14, "#e2e8f0");
        const ay = 20, ah = 90, span = 1.6; panel(ctx, PX, ay, PW, ah); timeGrid(ctx, t, span, PX, ay, PW, ah);
        drawWave(ctx, f0, t, span, PX, ay, PW, ah, d.scale, C.fil);
        const ww = (WIN / FS / span) * PW, wx = PX + PW - ww; ctx.fillStyle = "rgba(251,191,36,0.14)"; ctx.fillRect(wx, ay, ww, ah); ctx.strokeStyle = C.amber; ctx.strokeRect(wx + 0.5, ay + 0.5, ww, ah);
        ctx.beginPath(); for (let i = 0; i <= 40; i++) { const hx = wx + (i / 40) * ww, hy = ay + ah - (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 40)) * (ah - 6); i ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy); } ctx.stroke();
        label(ctx, "window × Hann", wx - 6, ay + 12, C.amber, "right");
        label(ctx, "2. FFT of that window", PX, 132, "#e2e8f0");
        const by = 138, bh = 52, sp = spectrum(f0, Math.floor(t * FS) - WIN, WIN, NFFT); panel(ctx, PX, by, PW, bh);
        specLine(ctx, sp, d.ref, DB, 128, PX, by, PW, bh, "rgba(251,191,36,0.3)", true); specLine(ctx, sp, d.ref, DB, 128, PX, by, PW, bh, C.amber, false);
        label(ctx, "0 Hz", PX, by + bh + 11); label(ctx, "500 Hz", PX + PW, by + bh + 11, C.txt, "right");
        label(ctx, "3. Spectra stack into a spectrogram", PX, 218, "#e2e8f0");
        const shown = Math.min(d.cols, Math.max(0, Math.floor((t * FS - WIN) / HOP) + 1));
        if (imgRef.current) drawSpec(ctx, imgRef.current, d.cols, shown, PX, 224, PW, 160);
        const hx = PX + (shown / d.cols) * PW; ctx.fillStyle = C.amber; ctx.fillRect(hx - 1, 224, 2, 160);
      } else if (p.stage === 3) {
        label(ctx, "Spectrogram image sent to the classifier", PX, 16, "#e2e8f0");
        const y = 24, h = 240; if (imgRef.current) drawSpec(ctx, imgRef.current, d.cols, d.cols, PX, y, PW, h);
        const cyc = c % 8, sweep = Math.min(1, cyc / 3.5), sx = PX + sweep * PW;
        ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1;
        for (let i = 1; i < 12; i++) { const gx = PX + (i / 12) * PW; if (gx < sx) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); } }
        for (let j = 1; j < 5; j++) { ctx.beginPath(); ctx.moveTo(PX, y + (j / 5) * h); ctx.lineTo(Math.min(sx, PX + PW), y + (j / 5) * h); ctx.stroke(); }
        if (sweep < 1) { const g = ctx.createLinearGradient(sx - 40, 0, sx, 0); g.addColorStop(0, "rgba(192,132,252,0)"); g.addColorStop(1, "rgba(192,132,252,0.5)"); ctx.fillStyle = g; ctx.fillRect(sx - 40, y, 40, h); }
        const names = ["Image", "Resize", "Backbone", "Neck", "Head"], lit = Math.min(5, Math.max(0, Math.floor(((cyc - 0.3) / 6) * 6)));
        names.forEach((nm, i) => {
          const bx = PX + i * 134, by = 288, on = i < lit;
          ctx.fillStyle = on ? "rgba(192,132,252,0.22)" : "#0b1220"; ctx.strokeStyle = on ? "#c084fc" : C.grid; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(bx, by, 112, 30, 6); ctx.fill(); ctx.stroke(); label(ctx, nm, bx + 56, by + 19, on ? "#f3e8ff" : C.txt, "center");
          if (i < 4) label(ctx, "›", bx + 123, by + 19, on ? "#c084fc" : C.txt, "center");
        });
        label(ctx, "Conceptual schematic, not the exact YOLOv8 layers", PX, 334, C.txt);
        const pr = p.variant === "normal" ? [0.93, 0.07] : [0.11, 0.89], k = Math.min(1, Math.max(0, (cyc - 6) / 0.8)), e = 1 - Math.pow(1 - k, 3);
        ["Normal", "Abnormal"].forEach((nm, i) => {
          const by = 346 + i * 26, top = (p.variant === "normal") === (i === 0);
          label(ctx, nm, PX, by + 10, top && k > 0 ? "#f3e8ff" : C.txt); ctx.fillStyle = "#111827"; ctx.fillRect(PX + 70, by, 400, 12);
          ctx.fillStyle = top ? "#c084fc" : "#475569"; ctx.fillRect(PX + 70, by, 400 * pr[i] * e, 12); if (k > 0) label(ctx, `${(pr[i] * e).toFixed(2)}`, PX + 480, by + 10, C.txt);
        });
        label(ctx, "Example output, not a model result", PX + PW, 394, C.txt, "right");
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const p = P.current, st = S.current;
      if (st.lastStage !== p.stage) { st.lastStage = p.stage; st.clock = 0; }
      if (p.playing) {
        st.t = (st.t + dt * p.speed) % DUR; st.clock += dt * p.speed;
        if (p.tour && st.clock > STAGE_SECS) setStage((s) => (s + 1) % STAGES.length);
      }
      draw(p, st);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const goto = (i: number, keepTour = false) => { setStage(((i % 5) + 5) % 5); if (!keepTour) setTour(false); };
  const restart = () => { S.current.t = 3; S.current.clock = 0; setStage(0); setPlaying(true); };
  const cur = STAGES[stage];
  const btn = "rounded-md border border-edge px-3 py-2 text-xs font-medium transition-colors hover:border-accent/50";
  const on = "border-accent/70 bg-accent/10 text-accent";

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface">
      <div className="grid lg:grid-cols-[1.25fr_0.75fr]">
        {/* simulation */}
        <div className="min-w-0 border-b border-edge p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{cur.title}</h3>
              <p className="mt-1 text-xs text-muted">Stage {stage + 1} of 5 · {variant === "normal" ? "Normal example" : "Abnormal example (murmur)"}</p>
            </div>
            <div className="flex gap-2" role="group" aria-label="Example recording">
              {(["normal", "abnormal"] as Variant[]).map((v) => (
                <button key={v} type="button" onClick={() => setVariant(v)} aria-pressed={variant === v} className={`${btn} ${variant === v ? on : ""}`}>{v === "normal" ? "Normal" : "Abnormal"}</button>
              ))}
            </div>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-lg border border-edge bg-[#070b14]">
            <canvas ref={canvasRef} className={`block h-auto w-full ${stage === 4 ? "invisible" : ""}`} role="img" aria-label={`Animated ${cur.title} view of a synthetic heart sound`} />
            {stage === 4 && (
              <div className="absolute inset-0 overflow-auto p-4 sm:p-6">
                <div className="mx-auto max-w-md rounded-xl border border-edge bg-surface p-5">
                  <p className="text-base font-semibold">Heart Sound Classifier</p>
                  <p className="mt-1 text-[11px] text-muted">Upload a .wav heart sound recording, then press Predict.</p>
                  <div className="mt-4 flex items-center justify-between rounded-md border border-dashed border-edge px-3 py-2 text-xs"><span>recording.wav</span><span className="text-muted">example file</span></div>
                  <button type="button" onClick={runPredict} disabled={predict === "running"} className="mt-3 rounded-md bg-accent px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60">{predict === "running" ? "Analysing…" : "Predict"}</button>
                  <div className="mt-4 min-h-[88px] rounded-lg border border-edge bg-background/60 p-4" aria-live="polite">
                    {predict === "idle" && <p className="text-xs text-muted">Press Predict to see an example result.</p>}
                    {predict === "running" && <div><p className="text-xs text-muted">Computing spectrogram, then classifying…</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-edge"><div className="h-full w-1/2 animate-pulse rounded-full bg-accent" /></div></div>}
                    {predict === "done" && <div><p className="text-xs text-muted">Class probabilities (example)</p><p className="mt-1 text-lg font-semibold text-accent">{variant === "normal" ? "Normal" : "Abnormal"}</p><p className="font-mono text-sm">confidence: {variant === "normal" ? "0.93" : "0.89"}</p></div>}
                  </div>
                  <p className="mt-3 text-[11px] text-muted">Example values only. Not a model output or medical result.</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPlaying((v) => !v)} aria-pressed={playing} className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90">{playing ? "Pause" : "Play"}</button>
            <button type="button" onClick={restart} className={btn}>Restart</button>
            <button type="button" onClick={() => goto(stage - 1)} className={btn} aria-label="Previous stage">← Prev</button>
            <button type="button" onClick={() => goto(stage + 1)} className={btn} aria-label="Next stage">Next →</button>
            <button type="button" onClick={() => setTour((v) => !v)} aria-pressed={tour} className={`${btn} ${tour ? on : ""}`}>Auto tour: {tour ? "on" : "off"}</button>
            <span className="ml-auto flex gap-1" role="group" aria-label="Playback speed">
              {[0.5, 1, 2].map((s) => <button key={s} type="button" onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`${btn} ${speed === s ? on : ""}`}>{s}×</button>)}
            </span>
          </div>
        </div>

        {/* explanation + controls */}
        <div className="flex flex-col p-4 sm:p-6">
          <div className="space-y-2" role="group" aria-label="Select processing stage">
            {STAGES.map((s, i) => (
              <button key={s.title} type="button" onClick={() => goto(i)} aria-pressed={stage === i} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${stage === i ? "border-accent/50 bg-accent/10" : "border-edge hover:border-accent/30"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs ${stage === i ? "bg-accent text-background" : "bg-edge text-muted"}`}>{i + 1}</span>
                <span className="min-w-0 flex-1 text-sm font-medium">{s.title}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-edge bg-background/50 p-4">
            <p className="text-sm leading-relaxed text-black">{cur.text}</p>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="rounded-md border border-edge p-3">
              <span className="flex justify-between text-xs text-muted"><span>Background noise</span><span className="font-mono text-foreground">{Math.round(noise * 100)}%</span></span>
              <input type="range" min="0" max="1" step="0.05" value={noise} onChange={(e) => setNoise(Number(e.target.value))} className="mt-2 w-full accent-current" aria-label="Background noise" />
            </label>
            <label className="rounded-md border border-edge p-3">
              <span className="flex justify-between text-xs text-muted"><span>Low-pass cutoff (paper: 200 Hz)</span><span className="font-mono text-foreground">{cutoff} Hz</span></span>
              <input type="range" min="80" max="450" step="10" value={cutoff} onChange={(e) => setCutoff(Number(e.target.value))} className="mt-2 w-full accent-current" aria-label="Low-pass cutoff frequency" />
            </label>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            Everything on the left is computed live in your browser from a synthetic signal: a Butterworth low-pass filter and a Hann-windowed FFT. The class and confidence shown are examples. No trained model runs here, and nothing on this page is a medical assessment.
          </p>
        </div>
      </div>
    </div>
  );
}
