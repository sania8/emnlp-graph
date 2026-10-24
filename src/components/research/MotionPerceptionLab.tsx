"use client";

import { useEffect, useRef, useState } from "react";

/* ---------- constants ---------- */
const W = 360, H = 240, N = 1100, CELL = 20, GX = W / CELL, GY = H / CELL, HIST = 48, FPS = 30;
const S_REF = 2.5; // reference dot speed (px/frame) used to scale the mask threshold

type ScenarioKey = "ball" | "pendulum" | "walker";
type Method = "lk" | "farneback" | "raft";
type Pt = { x: number; y: number };

const SCENARIOS: Record<ScenarioKey, { label: string; rx: number; ry: number; pos: (t: number) => Pt }> = {
  ball: { label: "Ball", rx: 30, ry: 30, pos: (t) => ({ x: W / 2 + 105 * Math.sin(t * 0.9), y: H - 52 - 95 * Math.abs(Math.sin(t * 1.8)) }) },
  pendulum: { label: "Pendulum", rx: 26, ry: 26, pos: (t) => { const a = 0.9 * Math.sin(t * 1.5); return { x: W / 2 + 130 * Math.sin(a), y: 22 + 130 * Math.cos(a) }; } },
  walker: { label: "Walking human", rx: 20, ry: 50, pos: (t) => ({ x: W / 2 + 100 * Math.sin(t * 0.9), y: H / 2 + 8 * Math.sin(t * 6) }) },
};

const METHODS: Record<Method, { label: string; note: string; radius: number }> = {
  lk: { label: "Lucas-Kanade", note: "Sparse: only a few feature points get a vector, so the motion looks broken and poorly aligned (Table 4).", radius: 0 },
  farneback: { label: "Farneback", note: "Dense: every pixel gets a vector, giving smooth motion that aligns well with the object (Table 4). This is the method the pipeline uses.", radius: 1 },
  raft: { label: "RAFT", note: "Dense but patchy: smooth in places, with gaps where occlusion and fast motion trip it up (Table 4).", radius: 2 },
};

const STAGES = [
  { title: "Raw frames", accuracy: 0, text: "One frame of a kinematogram is random dots. The figure only exists in how groups of dots move between frames, so a single frame gives a model nothing to classify. Pause the left panel to see exactly what a frame-by-frame model receives." },
  { title: "Dense optical flow", accuracy: 13.8, text: "Flow estimates how far dots moved between consecutive frames. Dots on the figure move together, so their vectors add up; background dots point in random directions and cancel out. Hue is direction, brightness is magnitude." },
  { title: "Binarisation", accuracy: 22.22, text: "Cells whose motion exceeds the threshold become white; everything else turns black. This isolates the high-motion region, as in the paper's Fig. 6. Drag the threshold to see noise appear or the figure disappear." },
  { title: "Denoising", accuracy: 31, text: "Isolated white cells with few white neighbours are removed, and small gaps inside the figure are filled. What is left is the cleaned motion silhouette." },
  { title: "High-motion frame selection + YOLOv9", accuracy: 47.22, text: "Over a rolling window of recent frames, the frame with the most white motion cells is selected (the paper's 'highest density of motion vectors'). That frame is what goes to YOLOv9. The box below is drawn around the real mask, but no YOLO model runs here." },
] as const;

/* ---------- simulation engine (plain TS, no React state) ---------- */
function makeSim() {
  let seed = 4217;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const x = new Float32Array(N), y = new Float32Array(N), px = new Float32Array(N), py = new Float32Array(N);
  const dx = new Float32Array(N), dy = new Float32Array(N), life = new Float32Array(N);
  for (let i = 0; i < N; i++) { x[i] = px[i] = rand() * W; y[i] = py[i] = rand() * H; life[i] = 6 + rand() * 24; }
  const hist: { density: number; mask: Uint8Array }[] = [];
  let frame = 0;
  let flowMx = new Float32Array(GX * GY), flowMy = new Float32Array(GX * GY), flowMag = new Float32Array(GX * GY);
  let raw = new Uint8Array(GX * GY), clean = new Uint8Array(GX * GY);
  let figure: Pt = { x: 0, y: 0 };
  const hash = (i: number, j: number) => ((i * 37 + j * 101 + 13) * 2654435761 >>> 0) % 100;

  function step(sc: ScenarioKey, speed: number, method: Method, thr: number) {
    const s = SCENARIOS[sc];
    const a = s.pos((frame * speed) / FPS), b = s.pos(((frame + 1) * speed) / FPS);
    const vx = b.x - a.x, vy = b.y - a.y;
    figure = a;

    // 1. move dots: inside the figure they share its velocity, outside they move at random
    for (let i = 0; i < N; i++) {
      px[i] = x[i]; py[i] = y[i];
      const ex = (x[i] - a.x) / s.rx, ey = (y[i] - a.y) / s.ry;
      let mx: number, my: number;
      if (ex * ex + ey * ey < 1) { mx = vx + (rand() - 0.5) * 0.5; my = vy + (rand() - 0.5) * 0.5; }
      else { const ang = rand() * 6.2832, sp = (0.5 + rand() * 2.5) * speed; mx = Math.cos(ang) * sp; my = Math.sin(ang) * sp; }
      dx[i] = mx; dy[i] = my;
      x[i] = (x[i] + mx + W) % W; y[i] = (y[i] + my + H) % H;
      if (--life[i] <= 0) { x[i] = rand() * W; y[i] = rand() * H; dx[i] = 0; dy[i] = 0; life[i] = 6 + rand() * 24; }
    }

    // 2. flow: average displacement per grid cell, then smooth according to method
    const cnt = new Float32Array(GX * GY), sx = new Float32Array(GX * GY), sy = new Float32Array(GX * GY);
    for (let i = 0; i < N; i++) {
      const cx = Math.min(GX - 1, Math.max(0, (px[i] / CELL) | 0)), cy = Math.min(GY - 1, Math.max(0, (py[i] / CELL) | 0));
      const k = cy * GX + cx; cnt[k]++; sx[k] += dx[i]; sy[k] += dy[i];
    }
    const r = METHODS[method].radius;
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      let c = 0, ax = 0, ay = 0;
      for (let jj = Math.max(0, j - r); jj <= Math.min(GY - 1, j + r); jj++)
        for (let ii = Math.max(0, i - r); ii <= Math.min(GX - 1, i + r); ii++) { const k = jj * GX + ii; c += cnt[k]; ax += sx[k]; ay += sy[k]; }
      const k = j * GX + i;
      let fx = c ? ax / c : 0, fy = c ? ay / c : 0;
      if (method === "lk" && hash(i, j) > 30) { fx = 0; fy = 0; }   // sparse feature points only
      if (method === "raft" && hash(i, j) < 20) { fx = 0; fy = 0; } // patchy dropouts
      flowMx[k] = fx; flowMy[k] = fy; flowMag[k] = Math.hypot(fx, fy);
    }

    // 3. binarise
    const t = thr * S_REF * speed;
    for (let k = 0; k < GX * GY; k++) raw[k] = flowMag[k] > t ? 1 : 0;

    // 4. denoise: drop isolated cells, fill small holes
    const nb = (arr: Uint8Array, i: number, j: number) => {
      let n = 0;
      for (let jj = -1; jj <= 1; jj++) for (let ii = -1; ii <= 1; ii++) {
        if (!ii && !jj) continue;
        const u = i + ii, v = j + jj;
        if (u >= 0 && v >= 0 && u < GX && v < GY) n += arr[v * GX + u];
      }
      return n;
    };
    clean = new Uint8Array(GX * GY);
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const k = j * GX + i, n = nb(raw, i, j);
      clean[k] = (raw[k] && n >= 3) || (!raw[k] && n >= 6) ? 1 : 0;
    }

    // 5. rolling history for frame selection
    let density = 0; for (let k = 0; k < clean.length; k++) density += clean[k];
    hist.push({ density, mask: clean }); if (hist.length > HIST) hist.shift();
    frame++;
  }

  function best() { let bi = 0; hist.forEach((h, i) => { if (h.density > hist[bi].density) bi = i; }); return bi; }

  function bbox(mask: Uint8Array) { // bounding box of the largest connected blob
    const seen = new Uint8Array(mask.length); let bestBox: number[] | null = null, bestSize = 0;
    for (let s0 = 0; s0 < mask.length; s0++) {
      if (!mask[s0] || seen[s0]) continue;
      const q = [s0]; seen[s0] = 1; let size = 0, x0 = GX, y0 = GY, x1 = 0, y1 = 0;
      while (q.length) {
        const k = q.pop()!, i = k % GX, j = (k / GX) | 0; size++;
        x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j);
        for (let jj = -1; jj <= 1; jj++) for (let ii = -1; ii <= 1; ii++) {
          const u = i + ii, v = j + jj, kk = v * GX + u;
          if (u >= 0 && v >= 0 && u < GX && v < GY && mask[kk] && !seen[kk]) { seen[kk] = 1; q.push(kk); }
        }
      }
      if (size > bestSize) { bestSize = size; bestBox = [x0, y0, x1 + 1, y1 + 1]; }
    }
    return bestSize >= 4 ? bestBox : null;
  }

  return {
    step, best, bbox, hist,
    get frame() { return frame; }, get figure() { return figure; },
    dots: { x, y }, flow: { mx: flowMx, my: flowMy, mag: flowMag, get raw() { return raw; }, get clean() { return clean; } },
    getFlow: () => ({ mx: flowMx, my: flowMy, mag: flowMag }),
    getMasks: () => ({ raw, clean }),
  };
}

/* ---------- drawing ---------- */
const BG = "#070b14";
function setup(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d")!; c.width = W * 2; c.height = H * 2; ctx.setTransform(2, 0, 0, 2, 0, 0); return ctx;
}
function drawDots(ctx: CanvasRenderingContext2D, xs: ArrayLike<number>, ys: ArrayLike<number>) {
  ctx.fillStyle = "#0d1424"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(226,232,240,0.88)";
  for (let i = 0; i < N; i++) ctx.fillRect(xs[i], ys[i], 2.2, 2.2);
}
function drawEllipse(ctx: CanvasRenderingContext2D, p: Pt, rx: number, ry: number) {
  ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, 6.2832); ctx.stroke(); ctx.restore();
}
function drawFlow(ctx: CanvasRenderingContext2D, f: { mx: Float32Array; my: Float32Array; mag: Float32Array }, speed: number) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const k = j * GX + i, m = f.mag[k]; if (m < 0.12 * speed) continue;
    const hue = ((Math.atan2(f.my[k], f.mx[k]) / 6.2832) * 360 + 360) % 360;
    const l = 22 + Math.min(1, m / (S_REF * speed * 1.6)) * 42;
    ctx.fillStyle = `hsl(${hue} 85% ${l}%)`; ctx.fillRect(i * CELL + 1, j * CELL + 1, CELL - 2, CELL - 2);
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1; ctx.beginPath();
    const cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2, s = 3.2 / Math.max(speed, 0.5);
    ctx.moveTo(cx, cy); ctx.lineTo(cx + f.mx[k] * s, cy + f.my[k] * s); ctx.stroke();
  }
}
function drawMask(ctx: CanvasRenderingContext2D, m: Uint8Array, color = "#f8fafc") {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); ctx.fillStyle = color;
  for (let k = 0; k < m.length; k++) if (m[k]) ctx.fillRect((k % GX) * CELL, ((k / GX) | 0) * CELL, CELL, CELL);
}

/* ---------- component ---------- */
export function MotionPerceptionLab() {
  const [stage, setStage] = useState(1);
  const [scenario, setScenario] = useState<ScenarioKey>("ball");
  const [method, setMethod] = useState<Method>("farneback");
  const [playing, setPlaying] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [thr, setThr] = useState(0.45);
  const [hist, setHist] = useState<{ d: number[]; best: number }>({ d: [], best: 0 });

  const leftRef = useRef<HTMLCanvasElement>(null);
  const rightRef = useRef<HTMLCanvasElement>(null);
  const P = useRef({ stage, scenario, method, playing, reveal, speed, thr });
  P.current = { stage, scenario, method, playing, reveal, speed, thr };

  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;
    const lctx = setup(leftRef.current), rctx = setup(rightRef.current);
    let sim = makeSim(); let last = 0, raf = 0, prevKey = "", snap: { x: Float32Array; y: Float32Array } | null = null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) setPlaying(false);

    const render = () => {
      const p = P.current, sc = SCENARIOS[p.scenario];
      const key = p.scenario + p.method; // restart cleanly when the scenario/method changes
      if (key !== prevKey) { sim = makeSim(); prevKey = key; snap = null; for (let i = 0; i < 4; i++) sim.step(p.scenario, p.speed, p.method, p.thr); }
      else sim.step(p.scenario, p.speed, p.method, p.thr);
      draw(p, sc);
    };
    const draw = (p: typeof P.current, sc: (typeof SCENARIOS)[ScenarioKey]) => {
      drawDots(lctx, sim.dots.x, sim.dots.y);
      if (p.reveal) drawEllipse(lctx, sim.figure, sc.rx, sc.ry);
      const { raw, clean } = sim.getMasks(), f = sim.getFlow();
      if (p.stage === 0) {
        if (!snap || sim.frame % 75 === 0) snap = { x: sim.dots.x.slice(), y: sim.dots.y.slice() };
        drawDots(rctx, snap.x, snap.y);
      } else if (p.stage === 1) drawFlow(rctx, f, p.speed);
      else if (p.stage === 2) drawMask(rctx, raw);
      else if (p.stage === 3) drawMask(rctx, clean);
      else {
        const b = sim.hist[sim.best()] ?? { mask: clean, density: 0 };
        drawMask(rctx, b.mask, "#e9d5ff");
        const box = sim.bbox(b.mask);
        if (box) {
          const [x0, y0, x1, y1] = box.map((v) => v * CELL);
          rctx.strokeStyle = "#c084fc"; rctx.lineWidth = 2; rctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
          rctx.fillStyle = "#3b0764"; rctx.fillRect(x0, Math.max(0, y0 - 16), 150, 16);
          rctx.fillStyle = "#f3e8ff"; rctx.font = "10px monospace"; rctx.fillText(`${sc.label} · illustrative`, x0 + 4, Math.max(11, y0 - 4));
        }
      }
    };
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 1000 / FPS) return; last = t;
      const p = P.current;
      if (p.playing || sim.frame === 0) render();
      else draw(p, SCENARIOS[p.scenario]); // paused: still redraw so stage/threshold/reveal changes show
      if (sim.frame % 4 === 0) setHist({ d: sim.hist.map((h) => h.density), best: sim.best() });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cur = STAGES[stage];
  const maxD = Math.max(1, ...hist.d);
  const btn = "rounded-md border border-edge px-3 py-2 text-xs font-medium transition-colors hover:border-accent/50";

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface shadow-sm">
      {/* header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-4 sm:px-6">
        <div>
          <h3 className="text-lg font-semibold">Find the hidden object from motion alone</h3>
          <p className="mt-1 text-xs text-muted">Every stage on the right is computed live from the dots on the left. Pause to see what one frame contains.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
            <button key={k} type="button" onClick={() => setScenario(k)} aria-pressed={scenario === k} className={`${btn} ${scenario === k ? "border-accent/70 bg-accent/10 text-accent" : ""}`}>{SCENARIOS[k].label}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-2">
        <figure className="min-w-0">
          <div className="overflow-hidden rounded-lg border border-edge bg-[#070b14]"><canvas ref={leftRef} className="block h-auto w-full" role="img" aria-label="Animated random-dot kinematogram containing a hidden moving object" /></div>
          <figcaption className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
            <span>Input: {N} random dots, {playing ? "playing" : "paused on one frame"}</span>
            <span className="flex gap-2">
              <button type="button" onClick={() => setPlaying((v) => !v)} aria-pressed={playing} className={btn}>{playing ? "Pause" : "Play"}</button>
              <button type="button" onClick={() => setReveal((v) => !v)} aria-pressed={reveal} className={`${btn} ${reveal ? "border-accent/70 text-accent" : ""}`}>{reveal ? "Hide figure" : "Reveal figure"}</button>
            </span>
          </figcaption>
        </figure>
        <figure className="min-w-0">
          <div className="overflow-hidden rounded-lg border border-edge bg-[#070b14]"><canvas ref={rightRef} className="block h-auto w-full" role="img" aria-label={`Stage output: ${cur.title}`} /></div>
          <figcaption className="mt-2 text-xs text-muted">Output of stage {stage + 1}: <span className="text-foreground">{cur.title}</span></figcaption>
        </figure>
      </div>

      {/* stage rail with Table 3 accuracies */}
      <div className="border-t border-edge px-4 py-4 sm:px-6">
        <div className="grid gap-2 sm:grid-cols-5" role="group" aria-label="Select processing stage">
          {STAGES.map((s, i) => (
            <button key={s.title} type="button" onClick={() => setStage(i)} aria-pressed={stage === i} className={`rounded-lg border p-3 text-left transition-colors ${stage === i ? "border-accent/70 bg-accent/10" : "border-edge hover:border-accent/40"}`}>
              <span className="block text-xs font-medium">{i + 1}. {s.title}</span>
              <span className="mt-2 block font-mono text-sm text-accent">{s.accuracy}%</span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-edge"><span className="block h-full rounded-full bg-accent" style={{ width: `${(s.accuracy / 47.22) * 100}%` }} /></span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">Accuracies are the paper's reported YOLOv9 results (Table 3), shown for reference. They are not produced by this demo.</p>
      </div>

      {/* stage explanation + controls */}
      <div className="grid gap-5 border-t border-edge p-4 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h4 className="text-base font-semibold">{cur.title}</h4>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{cur.text}</p>

          {stage === 1 && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Optical flow method">
                {(Object.keys(METHODS) as Method[]).map((m) => (
                  <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m} className={`${btn} ${method === m ? "border-accent/70 bg-accent/10 text-accent" : ""}`}>{METHODS[m].label}</button>
                ))}
              </div>
              <p className="mt-2 max-w-prose text-xs leading-relaxed text-muted">{METHODS[method].note} Qualitative illustration only; these are simplified stand-ins, not the real algorithms.</p>
            </div>
          )}

          {stage === 4 && (
            <div className="mt-4">
              <p className="text-xs text-muted">White-cell count over the last {HIST} frames. The tallest bar is the selected frame.</p>
              <div className="mt-2 flex h-16 items-end gap-[2px]" aria-hidden="true">
                {hist.d.map((d, i) => (
                  <span key={i} className={`flex-1 rounded-sm ${i === hist.best ? "bg-accent" : "bg-edge"}`} style={{ height: `${Math.max(4, (d / maxD) * 100)}%` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 content-start">
          <label className="rounded-md border border-edge p-3">
            <span className="flex justify-between text-xs text-muted"><span>Motion speed</span><span className="font-mono text-foreground">{speed.toFixed(1)}×</span></span>
            <input type="range" min="0.5" max="2" step="0.1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="mt-2 w-full accent-current" aria-label="Motion speed" />
          </label>
          <label className="rounded-md border border-edge p-3">
            <span className="flex justify-between text-xs text-muted"><span>Mask threshold</span><span className="font-mono text-foreground">{Math.round(thr * 100)}%</span></span>
            <input type="range" min="0.2" max="0.9" step="0.01" value={thr} onChange={(e) => setThr(Number(e.target.value))} className="mt-2 w-full accent-current" aria-label="Mask threshold" />
            <span className="mt-1 block text-[11px] text-muted">Lower keeps more cells (and noise); higher keeps only the fastest motion.</span>
          </label>
        </div>
      </div>

      <div className="border-t border-edge bg-background/60 px-4 py-3 sm:px-6">
        <p className="text-[11px] leading-relaxed text-muted">How this demo works: dots inside the hidden figure share its velocity, while all other dots move randomly. Flow, mask, denoising and frame selection are computed from those dots with simplified grid averaging, not Farneback, RAFT or YOLOv9. The box in stage 5 is drawn around the computed mask, and no classifier runs. The paper's 47.22% result is separate from this simulation.</p>
      </div>
    </div>
  );
}
