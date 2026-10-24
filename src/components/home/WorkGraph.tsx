"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type GraphWork = {
  id: string;
  href: string;
  label: string; // short label drawn on the node
  title: string; // full title shown in the caption on hover
  themes: string[]; // works sharing a theme are linked through that theme
};

type N = {
  id: string;
  label: string;
  title?: string;
  kind: "theme" | "work";
  href?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type E = { a: number; b: number; speed: number; offset: number };

const DEFAULT_CAPTION =
  "Hover a node to trace its links. Click a work to open it.";

export function WorkGraph({ works }: { works: GraphWork[] }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const wrapRef = useRef<HTMLDivElement>(null); // the canvas area (not the caption)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accentRef = useRef<HTMLSpanElement>(null);
  const mutedRef = useRef<HTMLSpanElement>(null);
  const [caption, setCaption] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const accentEl = accentRef.current;
    const mutedEl = mutedRef.current;
    if (!canvas || !wrap || !accentEl || !mutedEl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- build graph from props -------------------------------------------
    const themeNames = Array.from(new Set(works.flatMap((w) => w.themes)));
    const nodes: N[] = [
      ...themeNames.map((t) => ({
        id: "t:" + t,
        label: t,
        kind: "theme" as const,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      })),
      ...works.map((w) => ({
        id: "w:" + w.id,
        label: w.label,
        title: w.title,
        kind: "work" as const,
        href: w.href,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      })),
    ];
    const index = new Map(nodes.map((n, i) => [n.id, i]));
    const edges: E[] = works.flatMap((w) =>
      w.themes.map((t) => ({
        a: index.get("t:" + t)!,
        b: index.get("w:" + w.id)!,
        speed: 0.0002 + Math.random() * 0.0003,
        offset: Math.random(),
      }))
    );
    const adj: Set<number>[] = nodes.map(() => new Set<number>());
    edges.forEach((e) => {
      adj[e.a].add(e.b);
      adj[e.b].add(e.a);
    });

    // ---- state -------------------------------------------------------------
    let W = 0;
    let H = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    let first = true;
    let hover = -1;
    let mouse: { x: number; y: number } | null = null;
    let frameCount = 0;
    let accent = "#4ade80";
    let muted = "#888";
    let ink = "#ddd";

    // Text, nodes and margins all scale with the canvas width.
    // To make everything bigger, lower 640 (e.g. 520). To make it smaller, raise it.
    const scale = () => Math.max(1.15, Math.min(2.2, W / 640));

    const readColors = () => {
      accent = "#2563eb"; // nodes, highlighted links
      muted = "#64748b"; // links, theme labels
      ink = "#0f172a"; // work labels
    };

    // ---- simulation --------------------------------------------------------
    const step = (t: number) => {
      const k = Math.max(0.6, Math.min(3, Math.min(W / 760, H / 460)));
      const fs = scale();
      const mX = 70 * fs; // left/right margin, leaves room for labels
      const mTop = 40 * fs;
      const mBottom = 60 * fs; // labels hang below their node

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy + 40;
          const d = Math.sqrt(d2);
          const f = (9000 * k * k) / d2;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const f = (d - 150 * k) * 0.012;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      nodes.forEach((n, i) => {
        n.vx += (W / 2 - n.x) * 0.0006;
        n.vy += (H / 2 - n.y) * 0.0012;
        // slow idle drift so the graph never looks frozen
        n.vx += Math.sin(t * 0.0007 + i * 1.7) * 0.02;
        n.vy += Math.cos(t * 0.0006 + i * 2.3) * 0.02;
        if (mouse) {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
          if (d < 110) {
            const f = ((110 - d) / 110) * 0.6;
            n.vx += (dx / d) * f;
            n.vy += (dy / d) * f;
          }
        }
        n.vx *= 0.84;
        n.vy *= 0.84;
        n.x = Math.max(mX, Math.min(W - mX, n.x + n.vx));
        n.y = Math.max(mTop, Math.min(H - mBottom, n.y + n.vy));
      });

      // gently stretch the whole graph so it fills the canvas
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const n of nodes) {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
      }
      const sx = Math.max(0.97, Math.min(1.03, (W - 2 * mX) / (maxX - minX + 1)));
      const sy = Math.max(0.97, Math.min(1.03, (H - mTop - mBottom) / (maxY - minY + 1)));
      const mx = (minX + maxX) / 2;
      const my = (minY + maxY) / 2;
      const cx = W / 2;
      const cy = (mTop + (H - mBottom)) / 2;
      for (const n of nodes) {
        n.x = Math.max(mX, Math.min(W - mX, cx + (n.x - mx) * sx));
        n.y = Math.max(mTop, Math.min(H - mBottom, cy + (n.y - my) * sy));
      }
    };

    // ---- drawing -----------------------------------------------------------
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const fs = scale();
      const active = new Set<number>();
      if (hover >= 0) {
        active.add(hover);
        adj[hover].forEach((i) => active.add(i));
      }

      // links
      ctx.lineWidth = 1.2 * Math.max(1, fs * 0.8);
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        const touches = hover >= 0 && (e.a === hover || e.b === hover);
        ctx.globalAlpha = hover < 0 ? 0.28 : touches ? 0.9 : 0.05;
        ctx.strokeStyle = touches ? accent : muted;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // light pulse travelling theme -> work
        if (!reduce && (hover < 0 || touches)) {
          const p = (t * e.speed + e.offset) % 1;
          ctx.globalAlpha = hover < 0 ? 0.85 : 1;
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, 2.4 * fs, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // nodes + labels
      nodes.forEach((n, i) => {
        const isHover = i === hover;
        const alpha = hover < 0 || active.has(i) ? 1 : 0.18;
        ctx.globalAlpha = alpha;

        if (n.kind === "theme") {
          ctx.strokeStyle = muted;
          ctx.fillStyle = muted;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 6 * fs, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.6;
          ctx.beginPath();
          ctx.arc(n.x, n.y, (isHover ? 21 : 16) * fs, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const r = (isHover ? 14 : 10) * fs;
          ctx.fillStyle = accent;
          ctx.shadowColor = accent;
          ctx.shadowBlur = isHover ? 24 : 8;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = alpha * 0.3;
          ctx.strokeStyle = accent;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6 * fs, 0, Math.PI * 2);
          ctx.stroke();
        }

        // label: bigger for works, slightly smaller for themes
        ctx.globalAlpha = alpha * (n.kind === "theme" ? 0.9 : 1);
        ctx.font =
          n.kind === "theme"
            ? `600 ${Math.round(22 * fs)}px ui-monospace, SFMono-Regular, Menlo, monospace`
            : `700 ${Math.round(28 * fs)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = n.kind === "theme" ? muted : ink;
        ctx.textAlign = "center";
        const half = ctx.measureText(n.label).width / 2;
        const lx = Math.max(half + 8, Math.min(W - half - 8, n.x));
        ctx.fillText(n.label, lx, n.y + (n.kind === "theme" ? 34 : 38) * fs);
      });
      ctx.globalAlpha = 1;
    };

    // ---- sizing ------------------------------------------------------------
    const resize = () => {
      const nw = wrap.clientWidth;
      const nh = wrap.clientHeight;
      if (!nw || !nh) return;
      const ow = W;
      const oh = H;
      W = nw;
      H = nh;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (first) {
        nodes.forEach((n, i) => {
          const ang = (i / nodes.length) * Math.PI * 2;
          const r = Math.min(W, H) * 0.3 * (0.6 + Math.random() * 0.5);
          n.x = W / 2 + Math.cos(ang) * r * 1.4;
          n.y = H / 2 + Math.sin(ang) * r;
        });
        for (let s = 0; s < 260; s++) step(0); // settle before first paint
        first = false;
      } else if (ow && oh) {
        nodes.forEach((n) => {
          n.x *= W / ow;
          n.y *= H / oh;
        });
      }
      readColors();
    };

    // ---- loop --------------------------------------------------------------
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || !W) return;
      if (frameCount++ % 90 === 0) readColors(); // follows light/dark toggles
      if (!reduce) step(t);
      draw(t);
    };

    // ---- interaction -------------------------------------------------------
    const pick = (x: number, y: number) => {
      let best = -1;
      let bestD = 24 * scale();
      nodes.forEach((n, i) => {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    };

    const onMove = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      const h = pick(mouse.x, mouse.y);
      if (h !== hover) {
        hover = h;
        setCaption(h >= 0 ? nodes[h].title ?? nodes[h].label : null);
        canvas.style.cursor = h >= 0 && nodes[h].href ? "pointer" : "default";
      }
    };
    const onLeave = () => {
      mouse = null;
      hover = -1;
      setCaption(null);
      canvas.style.cursor = "default";
    };
    const onClick = () => {
      if (hover >= 0 && nodes[hover].href) routerRef.current.push(nodes[hover].href!);
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    resize();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [works]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-sky-200 bg-sky-50">
      {/* canvas area: fills whatever height the parent gives it */}
      <div ref={wrapRef} className="relative min-h-[360px] flex-1">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Interactive graph linking each paper and project to the research themes it belongs to. The same works are listed below."
          className="absolute inset-0 block touch-pan-y"
        />
        {/* hidden probes: let the canvas read your Tailwind theme colours */}
        <span ref={accentRef} aria-hidden className="sr-only text-accent">.</span>
        <span ref={mutedRef} aria-hidden className="sr-only text-muted">.</span>
      </div>

      {/* caption: outside the canvas, large text */}
      <p className="pointer-events-none line-clamp-2 min-h-[5rem] border-t border-sky-200 px-5 py-4 text-2xl font-medium leading-snug text-slate-600 xl:text-3xl">
        {caption ?? DEFAULT_CAPTION}
      </p>
    </div>
  );
}