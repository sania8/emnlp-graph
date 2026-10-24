"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Graph } from "@/lib/graph";

// "programme" = Keynotes / Panel / Tutorials / Workshops / Industry / Sessions (from the EMNLP programme page)
// "topic"     = the 8 biggest research topics
const MAIN_BY: "programme" | "topic" = "programme";

type D = Record<string, any>;
type GNode = { id: string; label: string; type: string; d: D };
type Kind = "hub" | "main" | "sub" | "focus" | "person" | "inst";
type Spec = {
  id: string; kind: Kind; label: string;
  x: number; y: number; o: number; r: number; w: number; h: number;
  from: { x: number; y: number };
  sel?: boolean; dim?: boolean; n?: number; photo?: string; idx?: number; fs?: number; col?: string;
};
type EdgeSpec = { id: string; a: string; b: string; style: "spoke" | "hl" | "sub" | "link" | "person" | "inst" | "co"; o: number; col?: string };
type Cur = { x: number; y: number; o: number; r: number; w: number; h: number };

const PROG: [RegExp, string][] = [
  [/industry/i, "Industry Track"], // must come first: "Industry keynote" / "Industry panel" would otherwise match below
  [/keynote/i, "Keynotes"],
  [/panel/i, "Panel"],
  [/tutorial/i, "Tutorials"],
  [/workshop/i, "Workshops"],
  [/bof|birds/i, "Birds of a Feather"],
];
const RANK = ["Keynotes", "Panel", "Tutorials", "Workshops", "Industry Track", "Sessions", "Birds of a Feather"];

const POP_W = 800; // person popup width (px)

// Apple system colours (dark appearance) from the Human Interface Guidelines colour palette.
const BLUE = "#0A84FF";
const GRAY = "#8E8E93";
const AREA_COL: Record<string, string> = {
  Keynotes: "#FF9F0A", // systemOrange
  Panel: "#BF5AF2", // systemPurple
  Tutorials: "#30D158", // systemGreen
  Workshops: "#0A84FF", // systemBlue
  "Industry Track": "#64D2FF", // systemCyan
  Sessions: "#FF375F", // systemPink
  "Birds of a Feather": "#FFD60A", // systemYellow
};
const EXTRA = ["#5E5CE6", "#AC8E68", "#32ADE6", "#FF6482"]; // indigo, brown, teal, red
const colOf = (label: string) =>
  AREA_COL[label] ?? EXTRA[[...label].reduce((a, c) => a + c.charCodeAt(0), 0) % EXTRA.length];
const onCol = (c: string) => (c === "#FFD60A" || c === "#64D2FF" || c === "#30D158" ? "#000" : "#fff");
// materials: translucent, blurred, saturated (Apple "regular" / "thick" material look)
const MAT: React.CSSProperties = {
  background: "rgba(28,28,30,0.72)",
  backdropFilter: "blur(40px) saturate(180%)",
  WebkitBackdropFilter: "blur(40px) saturate(180%)",
};
const THEME = {
  "--surface": "#1C1C1E", // secondarySystemBackground
  "--surface-raised": "#2C2C2E", // tertiarySystemBackground
  "--foreground": "#FFFFFF", // label
  "--muted": "#98989D", // secondaryLabel
  "--border": "#38383A", // separator
  "--accent": BLUE, // systemBlue
  background: "#000000", // systemBackground
  color: "#FFFFFF",
} as React.CSSProperties;

const urlOf = (v: any): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^(www\.)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(t)) return "https://" + t;
  return null;
};
// Official website: try the usual field names, then any other URL-looking field, else a search link.
const siteOf = (d: D, label: string, inst?: string) => {
  // the graph stores a person's homepage in `profile` (falls back to the emnlp.org page when none was found)
  const pr = urlOf(d.profile);
  if (pr && !/emnlp\.org|linkedin\.com/i.test(pr)) return { href: pr, found: true };
  for (const k of ["website", "homepage", "homePage", "webpage", "personalWebsite", "personal_website", "site", "web", "url", "link", "page"]) {
    const u = urlOf(d[k]);
    if (u) return { href: u, found: true };
  }
  const skip = /photo|image|avatar|img|linkedin|profile|twitter|scholar|github/i;
  for (const [k, v] of Object.entries(d)) {
    if (skip.test(k)) continue;
    const u = urlOf(v);
    if (u) return { href: u, found: true };
  }
  return { href: `https://duckduckgo.com/?q=${encodeURIComponent(`!ducky ${label} ${inst ?? ""} homepage`)}`, found: false };
};

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s);
const initials = (s: string) =>
  s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
const wrapLines = (s: string, n: number, max: number): string[] => {
  const out: string[] = [];
  let cur = "";
  for (const w of s.split(/\s+/).filter(Boolean)) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= n) cur += " " + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (out.length > max) {
    const k = out.slice(0, max);
    k[max - 1] = trunc(out.slice(max - 1).join(" "), n);
    return k;
  }
  return out.map((l) => trunc(l, n));
};
const wrapAngle = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", var(--font-geist-sans), system-ui, sans-serif';

// Apple HIG: depth through materials, spring-like motion, visible keyboard focus, respect reduced motion.
const CSS = `
@keyframes st-sheet { from { opacity: 0; transform: scale(.94) translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes st-fade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.st-in { transition: transform .35s cubic-bezier(.32,.72,0,1); transform-box: fill-box; transform-origin: center; }
.st-node:hover .st-in { transform: scale(1.05); }
.st-node:active .st-in { transform: scale(.97); }
.st-node:focus-visible { outline: 4px solid var(--accent); outline-offset: 8px; border-radius: 28px; }
@media (prefers-reduced-motion: reduce) { .st-anim, .st-in { animation: none !important; transition: none !important; } }
`;

// ---------- layout helpers (pure) ----------
function camFor(s: any, phase: number) {
  const { W, H } = s;
  const n = Math.max(s.groups.length, 1);
  const sn = n > 1 ? Math.sin(Math.PI / n) : 1;
  const cy = H / 2;
  if (phase === 0) {
    const R = Math.min(W, H) * 0.31;
    return { cx: W / 2, cy, R, nr: Math.min(100, R * sn * 0.82), fs: 42, hubR: 84 };
  }
  if (phase === 1) {
    const R = Math.min(H * 0.27, W * 0.11);
    return { cx: R + 130, cy, R, nr: Math.min(66, R * sn * 0.8), fs: 36, hubR: 58 };
  }
  const R = Math.min(H * 0.2, 96);
  return { cx: R + 70, cy, R, nr: Math.min(40, R * sn * 0.8), fs: 30, hubR: 42 };
}

// Region where the talk graph lives. The selected area node always sits at (px, py).
function fanBounds(s: any, phase: number) {
  const c = camFor(s, phase);
  const px = c.cx + c.R, py = c.cy;
  const x0 = px + c.nr + 50;
  const x1 = phase === 2 ? Math.max(x0 + 340, s.W * (s.pop ? 0.31 : 0.44)) : s.W - 30;
  return { px, py, x0, x1, y0: 50, y1: s.H - 56 };
}

// Talks as a radial graph: concentric half-ellipses fanning out of the selected area node,
// then a small overlap-removal pass. Cached because layout() runs every frame.
const FAN = new Map<string, { pos: { x: number; y: number }[]; hs: number[]; w: number; fs: number }>();
function fanNodes(s: any, labels: string[], phase: number) {
  const n = labels.length;
  const key = [s.W, s.H, n, phase, s.groups.length, s.areaId, s.pop ? 1 : 0].join("|");
  const hit = FAN.get(key);
  if (hit) return hit;
  if (FAN.size > 40) FAN.clear();

  let b = fanBounds(s, phase);
  const baseW = phase === 2 ? 340 : 400;
  const baseFs = phase === 2 ? 30 : 34;
  // every label is shown in full: node height grows with the number of wrapped lines
  const dims = (k: number) => {
    const w = baseW * k, fs = baseFs * k;
    const chars = Math.max(6, Math.floor((w - 26) / (fs * 0.57)));
    const hs = labels.map((l) => wrapLines(l, chars, 99).length * fs * 1.2 + 30 * k + 10);
    return { w, fs, hs };
  };
  const fits = (k: number) => {
    const d = dims(k);
    const area = d.hs.reduce((a, h) => a + (h + 14) * (d.w + 26), 0);
    return area * 1.45 <= (b.x1 - b.x0) * (b.y1 - b.y0);
  };
  // phase 1: use only as much width as the nodes need, so edges stay short
  if (phase === 1) {
    const full = b;
    for (let f = 0.3; f <= 1.0001; f += 0.05) {
      b = { ...full, x1: full.x0 + (full.x1 - full.x0) * f };
      if (fits(0.85)) break;
    }
  }
  let k = 1;
  while (k > 0.62 && !fits(k)) k -= 0.04;
  const { w, fs, hs } = dims(k);
  const h = hs.reduce((a, c) => a + c, 0) / Math.max(n, 1);

  const rxMin = b.x0 + w / 2 - b.px;
  const rxMax = Math.max(rxMin, b.x1 - w / 2 - b.px);
  const ryMax = Math.max(60, (b.y1 - b.y0) / 2 - h / 2);
  const thM = (72 * Math.PI) / 180;
  const ryOf = (i: number, K: number) => (K > 1 ? ryMax * (0.35 + 0.65 * (i / (K - 1))) : ryMax);
  const cap = (K: number) =>
    Array.from({ length: K }, (_, i) => Math.floor((2 * ryOf(i, K) * Math.sin(thM)) / (h + 10))).reduce((a, c) => a + c, 0);
  const maxK = Math.max(1, Math.min(7, Math.floor((rxMax - rxMin) / (w * 0.5)) + 1));
  let K = 1;
  while (K < maxK && cap(K) < n * 1.1) K++;

  const ry = Array.from({ length: K }, (_, i) => ryOf(i, K));
  const rx = Array.from({ length: K }, (_, i) =>
    K > 1 ? rxMin + ((rxMax - rxMin) * i) / (K - 1) : rxMin + (rxMax - rxMin) * 0.3
  );
  const tot = ry.reduce((a, c) => a + c, 0);
  const cnt = ry.map((r) => Math.floor((n * r) / tot));
  let rem = n - cnt.reduce((a, c) => a + c, 0);
  for (let i = K - 1; rem > 0; i = (i - 1 + K) % K, rem--) cnt[i]++;

  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < K; i++) {
    const m = cnt[i];
    for (let j = 0; j < m; j++) {
      const stag = ((i % 2 ? 1 : -1) * 0.15 * (2 * thM)) / Math.max(m, 1);
      const th = -thM + (2 * thM * (j + 0.5)) / m + stag;
      pts.push({ x: b.px + rx[i] * Math.cos(th), y: b.py + ry[i] * Math.sin(th) });
    }
  }

  // relax overlaps (per-node heights)
  const mx = 18, my = 10;
  const clamp = (p: { x: number; y: number }, i: number) => {
    p.x = Math.min(b.x1 - w / 2, Math.max(b.x0 + w / 2, p.x));
    p.y = Math.min(b.y1 - hs[i] / 2, Math.max(b.y0 + hs[i] / 2, p.y));
  };
  pts.forEach(clamp);
  for (let it = 0; it < 90; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        const ox = w + mx - Math.abs(dx), oy = (hs[i] + hs[j]) / 2 + my - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (oy < ox) {
            const sg = dy === 0 ? (j % 2 ? 1 : -1) : Math.sign(dy);
            pts[i].y -= (sg * oy) / 2; pts[j].y += (sg * oy) / 2;
          } else {
            const sg = dx === 0 ? 1 : Math.sign(dx);
            pts[i].x -= (sg * ox) / 2; pts[j].x += (sg * ox) / 2;
          }
        }
      }
    }
    pts.forEach(clamp);
    if (!moved) break;
  }

  const res = { pos: pts, hs, w, fs };
  FAN.set(key, res);
  return res;
}

function clusterGeom(s: any) {
  const b = fanBounds(s, 2);
  const left = b.x1 + 50;
  const right = s.pop ? s.W - POP_W - 50 : s.W - 80;
  const half = Math.max(160, (right - left) / 2);
  const m = Math.max(s.people?.length ?? 1, 1);
  const rIn = Math.min(300, Math.max(130, half * 0.55));
  // people nodes grow to the space available on the ring instead of shrinking
  const pr = m > 1 ? Math.min(92, Math.max(58, rIn * Math.sin(Math.PI / m) * 0.85)) : 92;
  const rxOut = Math.max(rIn + 120, Math.min(440, half - 20));
  // with a popup open, push the people graph right so the popup hugs it instead of sitting at the screen edge
  const tx = s.pop ? Math.max((left + right) / 2, right - rxOut - 180) : (left + right) / 2;
  const popLeft = Math.max(12, Math.min(s.W - 24 - POP_W, tx + rxOut + 180));
  return {
    tx,
    cy: s.H / 2,
    rIn,
    pr,
    rxOut,
    ryOut: Math.max(rIn + 140, Math.min(400, s.H / 2 - 110)),
    popLeft,
  };
}

function layout(s: any, cam: any, phi: number) {
  const specs: Spec[] = [];
  const edges: EdgeSpec[] = [];
  const { groups, areaId, talkId } = s;
  const n = groups.length;
  const phase = talkId ? 2 : areaId ? 1 : 0;
  const hub = { x: cam.cx, y: cam.cy };
  const mk = (o: Partial<Spec>): Spec => ({
    id: "", kind: "main", label: "", x: 0, y: 0, o: 1, r: 0, w: 0, h: 0, from: hub, col: BLUE, ...o,
  });

  specs.push(mk({ id: "hub", kind: "hub", label: s.title, x: hub.x, y: hub.y, r: cam.hubR }));

  const pos: Record<string, { x: number; y: number }> = {};
  groups.forEach((g: any, i: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n + phi;
    const sel = g.id === areaId;
    const dim = areaId !== null && !sel;
    const x = cam.cx + Math.cos(a) * cam.R;
    const y = cam.cy + Math.sin(a) * cam.R;
    pos[g.id] = { x, y };
    specs.push(mk({ id: g.id, kind: "main", label: g.label, x, y, r: cam.nr, o: dim ? 0.3 : 1, sel, dim, n: g.talks.length, col: colOf(g.label) }));
    edges.push({ id: "sp-" + g.id, a: "hub", b: g.id, style: sel ? "hl" : "spoke", o: dim ? 0.12 : sel ? 1 : 0.45, col: colOf(g.label) });
  });

  const selG = areaId ? groups.find((x: any) => x.id === areaId) : null;
  const gcol = selG ? colOf(selG.label) : BLUE;

  // level 2: talks as a radial graph. They stay visible when a talk is opened.
  let fanSel: { x: number; y: number } | null = null as any;
  if (areaId) {
    const g = groups.find((x: any) => x.id === areaId);
    if (g) {
      const fan = fanNodes(s, g.talks.map((t: GNode) => t.label), phase === 2 ? 2 : 1);
      g.talks.forEach((t: GNode, j: number) => {
        const f = fan.pos[j];
        if (!f) return;
        const sel = t.id === talkId;
        const faded = phase === 2 && !sel;
        const id = "s:" + t.id;
        if (sel) fanSel = { x: f.x, y: f.y };
        specs.push(mk({
          id, kind: "sub", label: t.label, x: f.x, y: f.y, w: fan.w, h: fan.hs[j], fs: fan.fs,
          o: faded ? 0.6 : 1, sel, from: pos[g.id], col: gcol,
        }));
        edges.push({ id: `hl-${g.id}-${t.id}`, a: g.id, b: id, style: sel ? "hl" : "sub", o: sel ? 1 : faded ? 0.22 : 0.6, col: gcol });
      });
    }
  }

  // level 3: people around an expanded copy of the chosen talk
  if (phase === 2) {
    const cl = clusterGeom(s);
    const people: GNode[] = s.people;
    const infos: any[] = s.infos;
    const m = people.length;
    const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / Math.max(m, 1);
    const origin = (fanSel as any) ?? hub;
    const fid = "c:" + talkId;
    const tl = s.talkLabel ?? "";

    const fw = 440, ffs = 34;
    const fl = wrapLines(tl, Math.floor((fw - 34) / (ffs * 0.57)), 99).length;
    specs.push(mk({
      id: fid, kind: "focus", label: tl, x: cl.tx, y: cl.cy, w: fw, h: fl * ffs * 1.2 + 48, fs: ffs, sel: true, from: origin, col: gcol,
    }));
    edges.push({ id: "tf-" + talkId, a: "s:" + talkId, b: fid, style: "link", o: 1, col: gcol });

    people.forEach((p, i) => {
      const sel = p.id === s.selPersonId;
      specs.push(mk({
        id: "p:" + p.id, kind: "person", label: p.label,
        x: cl.tx + Math.cos(ang(i)) * cl.rIn, y: cl.cy + Math.sin(ang(i)) * cl.rIn,
        r: sel ? cl.pr + 8 : cl.pr, sel, photo: p.d.photo, idx: i, from: { x: cl.tx, y: cl.cy }, col: gcol,
      }));
      edges.push({ id: "tp-" + p.id, a: fid, b: "p:" + p.id, style: "person", o: 1, col: gcol });
      if (m > 2) {
        const nx = people[(i + 1) % m];
        edges.push({ id: `co-${p.id}`, a: "p:" + p.id, b: "p:" + nx.id, style: "co", o: 0.55 });
      }
    });

    const im = new Map<string, number[]>();
    infos.forEach((inf, i) => inf.insts.forEach((nm: string) => im.set(nm, [...(im.get(nm) ?? []), i])));
    [...im].forEach(([label, idx]) => {
      const a = Math.atan2(idx.reduce((t, i) => t + Math.sin(ang(i)), 0), idx.reduce((t, i) => t + Math.cos(ang(i)), 0));
      const w0 = Math.min(label.length * 17 + 50, 360);
      const il = wrapLines(label, Math.floor((w0 - 36) / 16), 3).length;
      specs.push(mk({
        id: "i:" + label, kind: "inst", label,
        x: cl.tx + Math.cos(a) * cl.rxOut, y: cl.cy + Math.sin(a) * cl.ryOut,
        w: w0, h: il * 36 + 30, fs: 29, from: { x: cl.tx, y: cl.cy }, col: GRAY,
      }));
      idx.forEach((i) => edges.push({ id: `pi-${label}-${i}`, a: "p:" + people[i].id, b: "i:" + label, style: "inst", o: 0.7, col: GRAY }));
    });
  }
  return { specs, edges };
}

// ---------- small UI ----------
function Avatar({ src, name, size }: { src?: string; name: string; size: number }) {
  const [bad, setBad] = useState(false);
  return (
    <div
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-[28px] bg-white/10 font-semibold text-muted ring-1 ring-white/15"
      style={{ width: size, height: size, fontSize: size / 3 }}
    >
      {initials(name)}
      {src && !bad && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} referrerPolicy="no-referrer" onError={() => setBad(true)} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </div>
  );
}

export default function ConferenceStage({ graph, onExit }: { graph: Graph; onExit: () => void }) {
  const meta = graph.meta as any;

  const { nodes, nb } = useMemo(() => {
    const nodes = new Map<string, GNode>();
    for (const n of graph.elements.nodes as any[])
      nodes.set(n.data.id, { id: n.data.id, label: String(n.data.label ?? n.data.id), type: n.data.type, d: n.data });
    const adj = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!adj.has(a)) adj.set(a, new Set());
      adj.get(a)!.add(b);
    };
    for (const e of graph.elements.edges as any[]) {
      const { source: a, target: b } = e.data;
      if (nodes.has(a) && nodes.has(b)) {
        add(a, b);
        add(b, a);
      }
    }
    const nb = (id: string, type?: string) =>
      [...(adj.get(id) ?? [])].map((i) => nodes.get(i)!).filter((n) => !type || n.type === type);
    return { nodes, nb };
  }, [graph]);

  // main areas
  const groups = useMemo(() => {
    const m = new Map<string, GNode[]>();
    const put = (k: string, n: GNode) => m.set(k, [...(m.get(k) ?? []), n]);
    if (MAIN_BY === "programme") {
      nodes.forEach((n) => {
        if (n.type === "Talk") {
          const raw = String(n.d.talkType ?? "");
          const hit = PROG.find(([re]) => re.test(raw));
          put(hit ? hit[1] : raw || "Other talks", n);
        } else if (n.type === "Session") put("Sessions", n);
      });
    } else {
      nodes.forEach((n) => {
        if (n.type !== "Topic") return;
        let ts = nb(n.id, "Talk");
        if (!ts.length) {
          const mm = new Map<string, GNode>();
          nb(n.id, "Person").forEach((p) => nb(p.id, "Talk").forEach((t) => mm.set(t.id, t)));
          ts = [...mm.values()];
        }
        if (ts.length) m.set(n.label, ts);
      });
    }
    return [...m]
      .map(([label, items]) => ({ id: "g:" + label, label, talks: [...items].sort((a, b) => a.label.localeCompare(b.label)) }))
      .sort((a, b) => {
        const ra = RANK.indexOf(a.label), rb = RANK.indexOf(b.label);
        return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || b.talks.length - a.talks.length;
      })
      .slice(0, 8);
  }, [nodes, nb]);

  const [areaId, setAreaId] = useState<string | null>(null);
  const [talkId, setTalkId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [size, setSize] = useState({ W: 1280, H: 720 });
  const [, setTick] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<string | null>(null);

  // The layout is designed on a 1920px-wide canvas and scaled to the real window, so it looks the same on any screen.
  const VW = 1920;
  const k = Math.max(size.W, 1) / VW;
  const VH = Math.max(size.H, 1) / k;

  // selected sub area -> people
  const group = groups.find((g) => g.id === areaId) ?? null;
  const talk = talkId ? nodes.get(talkId) ?? null : null;
  const people: GNode[] = (() => {
    if (!talk) return [];
    const m = new Map<string, GNode>();
    nb(talk.id, "Person").forEach((p) => m.set(p.id, p));
    if (!m.size) nb(talk.id, "Talk").forEach((t) => nb(t.id, "Person").forEach((p) => m.set(p.id, p)));
    return [...m.values()];
  })();
  const infoOf = (p: GNode) => {
    const talksP = nb(p.id, "Talk");
    const insts = nb(p.id, "Institution").map((n) => n.label);
    const areas = new Set<string>();
    [...nb(p.id, "Topic"), ...talksP.flatMap((t) => nb(t.id, "Topic"))].forEach((n) => areas.add(n.label));
    const co = new Set<string>();
    talksP.forEach((t) => nb(t.id, "Person").forEach((q) => q.id !== p.id && co.add(q.label)));
    return {
      insts: insts.length ? insts : p.d.affiliation ? [String(p.d.affiliation)] : [],
      areas: [...areas].slice(0, 8),
      co: [...co],
      role: String(p.d.role ?? talk?.d.talkType ?? (talk?.type === "Session" ? "Participant" : "Speaker")),
    };
  };
  const infos = people.map(infoOf);
  const selPerson = personId ? people.find((p) => p.id === personId) : undefined;
  const selInfo = selPerson ? infos[people.indexOf(selPerson)] : null;

  // mirror state for the animation loop
  const S = useRef<any>({});
  S.current = {
    W: VW, H: VH, groups, areaId, talkId, people, infos,
    selPersonId: selPerson?.id ?? null, pop: !!selPerson, title: trunc(String(meta.conference ?? ""), 12),
    talkLabel: talk?.label ?? "",
  };

  const rt = useRef<any>({
    cur: new Map<string, Cur>(), ecur: new Map<string, number>(),
    last: new Map<string, Spec>(), lastE: new Map<string, EdgeSpec>(),
    specs: [] as Spec[], edges: [] as EdgeSpec[], cam: null as any, phi: 0, speed: 0.16, time: 0,
  });

  // size
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    setSize({ W: el.clientWidth, H: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // animation loop
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const r = rt.current;
      const s = S.current;
      if (!s.groups?.length) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      r.time += dt;
      const kc = reduce ? 1 : 1 - Math.exp(-dt * 4);
      const k = reduce ? 1 : 1 - Math.exp(-dt * 5.5);

      const phase = s.talkId ? 2 : s.areaId ? 1 : 0;
      const ct = camFor(s, phase);
      if (!r.cam) r.cam = { ...ct };
      for (const key of Object.keys(ct)) r.cam[key] += ((ct as any)[key] - r.cam[key]) * kc;

      if (s.areaId) {
        const i = s.groups.findIndex((g: any) => g.id === s.areaId);
        const phiT = -(-Math.PI / 2 + (2 * Math.PI * i) / s.groups.length);
        r.phi += wrapAngle(phiT - r.phi) * kc;
      } else {
        const target = hoverRef.current || reduce ? 0 : 0.16;
        r.speed += (target - r.speed) * kc;
        r.phi += r.speed * dt;
      }

      const { specs, edges } = layout(s, r.cam, r.phi);

      // ghosts: keep removed items for a moment so they fade out
      const ids = new Set(specs.map((x) => x.id));
      r.last.forEach((sp: Spec, id: string) => {
        if (!ids.has(id)) specs.push({ ...sp, o: 0 });
      });
      const eids = new Set(edges.map((x) => x.id));
      r.lastE.forEach((e: EdgeSpec, id: string) => {
        if (!eids.has(id)) edges.push({ ...e, o: 0 });
      });

      // ease
      const out: Spec[] = [];
      for (const sp of specs) {
        let c: Cur | undefined = r.cur.get(sp.id);
        if (!c) {
          c = { x: sp.from.x, y: sp.from.y, o: 0, r: sp.r, w: sp.w, h: sp.h };
          r.cur.set(sp.id, c);
        }
        c.x += (sp.x - c.x) * k;
        c.y += (sp.y - c.y) * k;
        c.o += (sp.o - c.o) * k;
        c.r += (sp.r - c.r) * k;
        c.w += (sp.w - c.w) * k;
        c.h += (sp.h - c.h) * k;
        if (sp.o === 0 && c.o < 0.02) r.cur.delete(sp.id);
        else out.push(sp);
      }
      const eout: EdgeSpec[] = [];
      for (const e of edges) {
        const v = (r.ecur.get(e.id) ?? 0) + (e.o - (r.ecur.get(e.id) ?? 0)) * k;
        r.ecur.set(e.id, v);
        if (e.o === 0 && v < 0.02) r.ecur.delete(e.id);
        else eout.push(e);
      }
      r.last = new Map(out.filter((x) => x.o > 0).map((x) => [x.id, x]));
      r.lastE = new Map(eout.filter((x) => x.o > 0).map((x) => [x.id, x]));
      r.specs = out;
      r.edges = eout;
      setTick((n) => (n + 1) % 1e9);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // navigation
  const back = () => {
    if (personId) setPersonId(null);
    else if (talkId) {
      setTalkId(null);
      setPersonId(null);
    } else if (areaId) setAreaId(null);
    else onExit();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && back();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const pickArea = (id: string) => {
    setAreaId(id === areaId ? null : id);
    setTalkId(null);
    setPersonId(null);
  };
  const pickTalk = (id: string) => {
    setTalkId(id);
    setPersonId(null);
  };
  const key = (fn: () => void) => (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && fn();

  // ---------- render ----------
  const r = rt.current;
  const cam = r.cam ?? camFor(S.current.groups ? S.current : { ...S.current, groups }, 0);
  const phase = talkId ? 2 : areaId ? 1 : 0;
  const crumbs = [group?.label, talk?.label].filter(Boolean) as string[];
  const stats: [string, number][] = [
    ["People", meta.counts.people],
    ["Talks", meta.counts.talks],
    ["Topics", meta.counts.topics],
  ];

  const selCol = group ? colOf(group.label) : BLUE;

  return (
    <div className="flex h-full flex-col" style={{ ...THEME, fontFamily: FONT, letterSpacing: "-0.011em" }}>
      <style>{CSS}</style>

      {/* navigation bar: translucent material, large title, 44pt+ targets */}
      <header
        className="z-20 flex flex-wrap items-center gap-x-6 gap-y-3 px-8 py-4"
        style={{ ...MAT, borderBottom: "0.5px solid rgba(84,84,88,0.65)" }}
      >
        <button
          onClick={back}
          className="flex min-h-[56px] items-center gap-2 rounded-full bg-accent/15 pl-4 pr-7 text-2xl font-semibold text-accent transition-colors hover:bg-accent/25 active:scale-95"
        >
          <svg width="16" height="26" viewBox="0 0 16 26" aria-hidden="true">
            <path d="M13 3 3 13l10 10" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-4xl font-bold tracking-tight">{meta.conference}</h2>
          <nav aria-label="Breadcrumb" className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-2xl text-muted">
            {crumbs.length === 0 && <span>Select an area</span>}
            {crumbs.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-2">
                {i > 0 && <span aria-hidden="true">›</span>}
                <span className="truncate rounded-full px-4 py-0.5 text-foreground" style={{ background: selCol + "33" }}>{c}</span>
              </span>
            ))}
          </nav>
        </div>
        <dl className="flex gap-3">
          {stats.map(([l, v]) => (
            <div key={l} className="min-w-[110px] rounded-2xl bg-white/[0.07] px-5 py-2 text-center">
              <dd className="text-3xl font-bold tabular-nums">{v}</dd>
              <dt className="text-xl text-muted">{l}</dt>
            </div>
          ))}
        </dl>
      </header>

      <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden">
        <svg
          width={size.W}
          height={size.H}
          viewBox={`0 0 ${VW} ${VH}`}
          className="absolute inset-0"
          role="group"
          aria-label="Conference graph"
          style={{ fontFamily: FONT }}
        >
          <defs>
            <filter id="st-shadow" x="-30%" y="-30%" width="160%" height="170%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* edges */}
          {r.edges.map((e: EdgeSpec) => {
            const A = r.cur.get(e.a) as Cur | undefined;
            const B = r.cur.get(e.b) as Cur | undefined;
            if (!A || !B) return null;
            const o = (r.ecur.get(e.id) ?? 0) * Math.min(A.o, B.o);
            if (o < 0.01) return null;
            const flow = e.style === "hl" || e.style === "person" || e.style === "link";
            const tinted = flow || e.style === "sub";
            const curved = e.style === "sub" || e.style === "link" || e.style === "person" || e.style === "inst" || e.id.startsWith("hl-");
            let d = `M${A.x},${A.y} L${B.x},${B.y}`;
            if (curved) {
              const dx = B.x - A.x, dy = B.y - A.y;
              d = `M${A.x},${A.y} Q${(A.x + B.x) / 2 - dy * 0.1},${(A.y + B.y) / 2 + dx * 0.1} ${B.x},${B.y}`;
            }
            return (
              <path
                key={e.id}
                d={d}
                fill="none"
                opacity={o}
                strokeLinecap="round"
                stroke={tinted ? e.col ?? BLUE : "#636366"}
                strokeWidth={e.style === "hl" || e.style === "link" ? 5 : e.style === "person" ? 4 : e.style === "sub" ? 2.5 : 2}
                strokeDasharray={flow ? "18 12" : e.style === "co" ? "8 10" : undefined}
                strokeDashoffset={flow ? -r.time * 50 : undefined}
              />
            );
          })}

          {/* nodes */}
          {r.specs.map((sp: Spec) => {
            const c = r.cur.get(sp.id) as Cur | undefined;
            if (!c) return null;
            const col = sp.col ?? BLUE;
            const common = {
              transform: `translate(${c.x},${c.y})`,
              opacity: c.o,
              style: { pointerEvents: c.o > 0.5 ? "auto" : "none" } as React.CSSProperties,
            };
            const glass = "rgba(255,255,255,0.14)";

            if (sp.kind === "hub") {
              return (
                <g key={sp.id} {...common}>
                  <circle r={c.r} className="fill-surface" filter="url(#st-shadow)" />
                  <circle r={c.r} fill={col} fillOpacity={0.18} stroke={col} strokeWidth={4} />
                  <text y={c.r * 0.12} textAnchor="middle" fontSize={Math.max(26, c.r * 0.34)} fontWeight={700} className="fill-current">
                    {sp.label}
                  </text>
                </g>
              );
            }

            if (sp.kind === "main") {
              const hov = hoverRef.current === sp.id;
              return (
                <g
                  key={sp.id}
                  {...common}
                  role="button"
                  tabIndex={0}
                  aria-label={`${sp.label}, ${sp.n} items`}
                  className="st-node cursor-pointer outline-none"
                  onClick={() => pickArea(sp.id)}
                  onKeyDown={key(() => pickArea(sp.id))}
                  onMouseEnter={() => (hoverRef.current = sp.id)}
                  onMouseLeave={() => (hoverRef.current = null)}
                >
                  <g className="st-in">
                    <circle r={c.r} className="fill-surface" filter="url(#st-shadow)" />
                    <circle r={c.r} fill={col} fillOpacity={sp.sel ? 0.38 : 0.16} stroke={col} strokeWidth={sp.sel ? 6 : hov ? 5 : 3} />
                    <circle r={c.r - 5} fill="none" stroke={glass} strokeWidth={1.5} />
                    <text y={c.r * 0.24} textAnchor="middle" fontSize={Math.max(30, c.r * 0.66)} fontWeight={700} className="fill-current">
                      {sp.n}
                    </text>
                  </g>
                  <text
                    y={c.r + cam.fs + 8}
                    textAnchor="middle"
                    fontSize={cam.fs}
                    fontWeight={700}
                    paintOrder="stroke"
                    stroke="#000"
                    strokeWidth={8}
                    strokeLinejoin="round"
                    className="fill-current"
                    style={{ opacity: phase === 2 && !sp.sel ? 0 : 1, transition: "opacity .4s" }}
                  >
                    {sp.label}
                  </text>
                </g>
              );
            }

            if (sp.kind === "sub" || sp.kind === "focus") {
              const fs = sp.fs ?? 30;
              const chars = Math.max(6, Math.floor((sp.w - 30) / (fs * 0.57)));
              const lines = wrapLines(sp.label, chars, 99); // never truncate titles
              const lh = fs * 1.2;
              const focus = sp.kind === "focus";
              const click = focus ? undefined : () => pickTalk(sp.id.slice(2));
              return (
                <g
                  key={sp.id}
                  {...common}
                  role={focus ? undefined : "button"}
                  tabIndex={focus ? undefined : 0}
                  aria-label={focus ? undefined : sp.label}
                  className={focus ? "outline-none" : "st-node cursor-pointer outline-none"}
                  onClick={click}
                  onKeyDown={click ? key(click) : undefined}
                >
                  <g className="st-in">
                    <rect x={-c.w / 2} y={-c.h / 2} width={c.w} height={c.h} rx={26} className="fill-surface" filter={sp.sel ? "url(#st-shadow)" : undefined} />
                    <rect
                      x={-c.w / 2} y={-c.h / 2} width={c.w} height={c.h} rx={26}
                      fill={col} fillOpacity={sp.sel ? 0.34 : 0.14} stroke={col} strokeWidth={sp.sel ? 5 : 2.5}
                    />
                    <rect x={-c.w / 2 + 3} y={-c.h / 2 + 3} width={c.w - 6} height={c.h - 6} rx={23} fill="none" stroke={glass} strokeWidth={1.5} />
                    {lines.map((ln, i) => (
                      <text
                        key={i}
                        x={0}
                        y={(i - (lines.length - 1) / 2) * lh + fs * 0.35}
                        textAnchor="middle"
                        fontSize={fs}
                        fontWeight={sp.sel ? 700 : 600}
                        className="fill-current"
                      >
                        {ln}
                      </text>
                    ))}
                  </g>
                </g>
              );
            }

            if (sp.kind === "person") {
              const pr = c.r - 5;
              const nameLines = wrapLines(sp.label, 14, 2);
              const toggle = () => setPersonId((cur) => (cur === sp.id.slice(2) ? null : sp.id.slice(2)));
              return (
                <g
                  key={sp.id}
                  {...common}
                  role="button"
                  tabIndex={0}
                  aria-label={`${sp.label}, show details`}
                  className="st-node cursor-pointer outline-none"
                  onClick={toggle}
                  onKeyDown={key(toggle)}
                >
                  <clipPath id={`cp${sp.idx}`}>
                    <circle r={pr} />
                  </clipPath>
                  <g className="st-in">
                    <circle r={c.r} className="fill-surface" filter="url(#st-shadow)" />
                    <circle r={c.r} fill={col} fillOpacity={sp.sel ? 0.38 : 0.16} stroke={col} strokeWidth={sp.sel ? 7 : 3.5} />
                    <text y={c.r * 0.22} textAnchor="middle" fontSize={c.r * 0.62} fontWeight={600} className="fill-current text-muted">
                      {initials(sp.label)}
                    </text>
                    {sp.photo && (
                      <image
                        href={sp.photo}
                        x={-pr} y={-pr} width={pr * 2} height={pr * 2}
                        clipPath={`url(#cp${sp.idx})`}
                        preserveAspectRatio="xMidYMid slice"
                        {...({ referrerPolicy: "no-referrer" } as any)}
                        onError={(ev) => ((ev.currentTarget as SVGImageElement).style.display = "none")}
                      />
                    )}
                  </g>
                  {nameLines.map((ln, i) => (
                    <text
                      key={i}
                      y={c.r + 38 + i * 38}
                      textAnchor="middle"
                      fontSize={34}
                      fontWeight={sp.sel ? 700 : 600}
                      paintOrder="stroke"
                      stroke="#000"
                      strokeWidth={9}
                      strokeLinejoin="round"
                      className="fill-current"
                    >
                      {ln}
                    </text>
                  ))}
                </g>
              );
            }

            // institution
            const il = wrapLines(sp.label, Math.floor((sp.w - 36) / 16), 3);
            return (
              <g key={sp.id} {...common}>
                <rect x={-sp.w / 2} y={-sp.h / 2} width={sp.w} height={sp.h} rx={22} className="fill-surface" />
                <rect x={-sp.w / 2} y={-sp.h / 2} width={sp.w} height={sp.h} rx={22} fill="rgba(255,255,255,0.05)" stroke="#636366" strokeWidth={2} />
                {il.map((ln, i) => (
                  <text key={i} y={(i - (il.length - 1) / 2) * 36 + 10} textAnchor="middle" fontSize={29} fontWeight={500} className="fill-current text-muted">
                    {ln}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>

        {/* hints: capsule material */}
        {phase === 0 && (
          <p className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full px-10 py-3 text-3xl font-medium text-muted ring-1 ring-white/10" style={MAT}>
            Select an area to open it
          </p>
        )}
        {phase === 1 && (
          <p className="pointer-events-none absolute bottom-6 right-10 rounded-full px-8 py-3 text-3xl font-medium text-muted ring-1 ring-white/10" style={MAT}>
            Select a talk →
          </p>
        )}
        {phase === 2 && people.length === 0 && (
          <div className="absolute bottom-6 right-10 max-w-[44%] rounded-3xl px-8 py-5 text-right text-3xl font-medium text-muted ring-1 ring-white/10" style={MAT}>
            No people are listed for this item on the official pages.
            {talk?.d.url && urlOf(talk.d.url) && !/emnlp\.org/i.test(talk.d.url) && (
              <a
                className="mt-3 inline-flex min-h-[52px] items-center rounded-2xl px-6 text-2xl font-semibold"
                style={{ background: selCol, color: onCol(selCol) }}
                href={talk.d.url}
                target="_blank"
                rel="noreferrer"
              >
                Open its page ↗
              </a>
            )}
          </div>
        )}

        {/* person sheet: translucent material beside the people graph */}
        {phase === 2 && selPerson && selInfo && (() => {
          const c = r.cur.get("p:" + selPerson.id) as Cur | undefined;
          if (!c) return null;
          const left = clusterGeom(S.current).popLeft * k;
          const half = Math.min(size.H / 2 - 12, 280 * k);
          const top = Math.min(Math.max(c.y * k, half + 12), size.H - half - 12);
          const web = siteOf(selPerson.d, selPerson.label, selInfo.insts[0]);
          const prof = urlOf(selPerson.d.profile);
          const li = urlOf(selPerson.d.linkedin);
          const cap = "text-lg font-semibold uppercase tracking-wider text-muted";
          const box = "mt-3 rounded-3xl bg-white/[0.07] px-5 py-3";
          const sheetStyle = {
            ...MAT,
            background: "rgba(28,28,30,0.84)",
            "--accent": selCol,
            maxHeight: Math.min(size.H - 24, size.H * 0.9),
            animation: "st-sheet .45s cubic-bezier(0.32,0.72,0,1) both",
          } as React.CSSProperties;
          return (
            <div className="absolute z-10" style={{ left, top, width: POP_W * k, transform: "translateY(-50%)" }}>
              <aside
                key={selPerson.id}
                className="st-anim relative overflow-y-auto rounded-[34px] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/15 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={sheetStyle}
              >
                <button
                  onClick={() => setPersonId(null)}
                  aria-label="Close"
                  className="absolute right-4 top-4 grid h-[52px] w-[52px] place-items-center rounded-full bg-white/10 text-muted transition-colors hover:bg-white/20 active:scale-95"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M4 4l12 12M16 4 4 16" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                  </svg>
                </button>

                <div className="flex items-center gap-4 pr-14">
                  <Avatar src={selPerson.d.photo} name={selPerson.label} size={Math.round(96 * Math.max(k, 0.7))} />
                  <div className="min-w-0">
                    <h4 className="text-3xl font-bold leading-tight tracking-tight">{selPerson.label}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="rounded-full bg-accent/20 px-3 py-0.5 text-xl font-medium text-accent">{selInfo.role}</span>
                      {selInfo.insts.length > 0 && <span className="text-xl text-muted">{selInfo.insts.join(" · ")}</span>}
                    </div>
                  </div>
                </div>

                {selPerson.d.bio && (
                  <section className={box}>
                    <p className={cap}>About</p>
                    <p className="mt-1 line-clamp-3 text-xl leading-snug">{selPerson.d.bio}</p>
                  </section>
                )}

                {selInfo.areas.length > 0 && (
                  <section className={box}>
                    <p className={cap}>Research areas</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selInfo.areas.map((a) => (
                        <span key={a} className="rounded-full bg-accent/20 px-4 py-1 text-lg font-medium text-accent">{a}</span>
                      ))}
                    </div>
                  </section>
                )}

                {selInfo.co.length > 0 && (
                  <section className={box}>
                    <p className={cap}>Co-authors · {selInfo.co.length}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selInfo.co.map((n) => (
                        <span key={n} className="inline-flex items-center gap-2 rounded-full bg-white/[0.09] py-1 pl-1 pr-4 text-lg">
                          <span className="grid h-[1.7rem] w-[1.7rem] shrink-0 place-items-center rounded-full bg-accent/25 text-xs font-bold text-accent">
                            {initials(n)}
                          </span>
                          {n}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    className="flex min-h-[56px] flex-[2] items-center justify-center whitespace-nowrap rounded-2xl px-6 text-2xl font-semibold transition-transform active:scale-[0.98]"
                    style={{ background: selCol, color: onCol(selCol) }}
                    href={web.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {web.found ? "Visit official website ↗" : "Find website ↗"}
                  </a>
                  {prof && prof !== web.href && (
                    <a className="flex min-h-[56px] flex-1 items-center justify-center rounded-2xl bg-accent/20 px-5 text-2xl font-semibold text-accent hover:bg-accent/30" href={prof} target="_blank" rel="noreferrer">Profile</a>
                  )}
                  {li && (
                    <a className="flex min-h-[56px] flex-1 items-center justify-center rounded-2xl bg-accent/20 px-5 text-2xl font-semibold text-accent hover:bg-accent/30" href={li} target="_blank" rel="noreferrer">LinkedIn</a>
                  )}
                </div>
              </aside>
            </div>
          );
        })()}
      </div>
    </div>
  );
}