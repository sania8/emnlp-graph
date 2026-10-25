"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Graph } from "@/lib/graph";
import "./conference.css";
import ConferenceSearch, { type SearchItem } from "./Conferencesearch";
import { usePersonPapers } from "./usePersonPapers";

// "programme" = Keynotes / Panel / Tutorials / Workshops / Industry / Sessions (from the EMNLP programme page)
// "topic"     = the 8 biggest research topics
// RESEARCH-AREA GRAPH: main ring = research areas, talks fan out of each area,
// dotted links join areas that share talks (thicker = more shared talks).

type D = Record<string, any>;
type GNode = { id: string; label: string; type: string; d: D };
type Kind = "hub" | "main" | "sub" | "focus" | "person" | "inst" | "coauth" | "link";
type Spec = {
  id: string; kind: Kind; label: string;
  x: number; y: number; o: number; r: number; w: number; h: number;
  from: { x: number; y: number };
  sel?: boolean; dim?: boolean; n?: number; photo?: string; idx?: number; fs?: number;
  href?: string; sitelabel?: string; pick?: boolean; color?: string; pid?: string;
};
type EdgeSpec = { id: string; a: string; b: string; style: "spoke" | "hl" | "sub" | "link" | "person" | "inst" | "co" | "coa" | "xlink"; o: number; color?: string; w?: number };
type Cur = { x: number; y: number; o: number; r: number; w: number; h: number };


// Apple system colours (light mode), one per node family
const PAL = ["#007AFF", "#34C759", "#FF9500", "#FF2D55", "#AF52DE", "#30B0C7", "#FF3B30", "#5856D6"];

// logical stage size; smaller screens scale down (smaller values = bigger content on screen)
const MIN_W = 1700, MIN_H = 600;
const MIN_W_PHONE = 720, MIN_H_PHONE = 540; // phones use a much smaller logical stage
const POP_W = 760; // person popup width (px)
// width of the link card (items without people); scales with the stage so it works on every screen
const linkW = (W: number) => Math.min(520, Math.max(380, W * 0.2));
// the SVG is much wider than the screen: the graph lives in a fixed 'world' and a camera pan brings the newest level into view
const WORLD_EXTRA = 8000;
const popWOf = (W: number) => Math.min(POP_W, Math.max(520, W * 0.28));

// Apple system fills (used for inner panels / pills)
const FILL = "rgba(120,120,128,0.24)"; // systemFill
const FILL2 = "rgba(120,120,128,0.16)"; // secondarySystemFill

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

// Short intro that always ends on a full sentence (never cut mid-line with "…").
const shortBio = (bio: string, max = 240): string => {
  // protect full stops that do not end a sentence: titles (Dr., Prof.), initials (R., S.), Ph.D., U.S., etc.
  const DOT = "\u0001";
  const safe = bio
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(Dr|Prof|Mr|Mrs|Ms|St|Jr|Sr|vs|etc|e\.g|i\.e|Inc|Ltd|Univ|Dept)\./g, (m) => m.replace(/\./g, DOT))
    .replace(/\b(?:[A-Z]\.){1,}(?=\s|[A-Za-z])/g, (m) => m.replace(/\./g, DOT))
    .replace(/\bPh\.D\./g, (m) => m.replace(/\./g, DOT));
  const sents = safe.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((x) => x.trim()) ?? [];
  if (!sents.length) return "";
  let out = sents[0];
  for (let i = 1; i < sents.length && i < 3; i++) {
    if ((out + " " + sents[i]).length > max) break;
    out += " " + sents[i];
  }
  out = out.split(DOT).join(".");
  return /[.!?]$/.test(out) ? out : out + ".";
};

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", var(--font-geist-sans), system-ui, sans-serif';

// ---------- layout helpers (pure) ----------
function camFor(s: any, phase: number) {
  const { W, H } = s;
  const n = Math.max(s.groups.length, 1);
  const sn = n > 1 ? Math.sin(Math.PI / n) : 1;
  const cy = H / 2;
  if (!s.compact || phase === 0) {
    // desktop: the ring keeps the same place and size on every level (a camera pan makes room for the next graph)
    const R = Math.min(W, H) * 0.31;
    return { cx: W / 2, cy, R, nr: Math.max(24, Math.min(100, R * sn * 0.82)), fs: 42, hubR: 84 };
  }
  if (phase === 1) {
    // phone: medium ring, a little to the left
    const R = Math.min(H * 0.25, W * 0.11, 210);
    return { cx: R + 110, cy, R, nr: Math.max(24, Math.min(70, R * sn * 0.8)), fs: 34, hubR: 58 };
  }
  const R = Math.min(H * 0.2, 120);
  return { cx: -500, cy, R, nr: 40, fs: 30, hubR: 42 };
}

// Region where the talk graph lives. The selected area node always sits at (px, py).
function fanBounds(s: any, phase: number, n = 0) {
  const c = camFor(s, phase);
  const px = c.cx + c.R, py = c.cy;
  if (s.compact) {
    const x0 = px + c.nr + 50;
    const x1 = phase === 2 ? x0 + 300 : s.W - 30;
    return { px, py, x0, x1, y0: 50, y1: s.H - 56 };
  }
  const x0 = px + c.nr + 110; // long edge out of the selected area node
  // width of the talk graph does not depend on the screen, so its position is the same on every level
  const span = Math.max(820, s.W * 0.5, Math.min(1700, n * 60)) + (s.zoneW || 0);
  return { px, py, x0, x1: x0 + span, y0: 50, y1: s.H - 56 };
}

// Talks as a radial graph: concentric half-ellipses fanning out of the selected area node,
// then a small overlap-removal pass. Cached because layout() runs every frame.
const FAN = new Map<string, { pos: { x: number; y: number }[]; hs: number[]; w: number; fs: number }>();
function fanNodes(s: any, labels: string[], phase: number) {
  const n = labels.length;
  const key = [s.W, s.H, n, phase, s.groups.length, s.areaId, s.pop ? 1 : 0, s.zoneW | 0, s.compact ? 1 : 0].join("|");
  const hit = FAN.get(key);
  if (hit) return hit;
  if (FAN.size > 40) FAN.clear();

  let b = fanBounds(s, phase, n);
  if (phase === 1 && s.zoneW) b = { ...b, x1: Math.max(b.x0 + 400, b.x1 - s.zoneW) };
  const baseW = s.compact ? (phase === 2 ? 340 : 360) : 420;
  const baseFs = s.compact ? (phase === 2 ? 30 : 31) : 36;
  const loose = s.compact ? 1.45 : 1.75; // more breathing room between nodes on desktop
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
    return area * loose <= (b.x1 - b.x0) * (b.y1 - b.y0);
  };
  // phase 1: use only as much width as the nodes need, so edges stay short
  if (phase === 1) {
    // keep the fan compact (close to the phase-2 column) whenever the nodes still fit
    const wide = b;
    b = { ...wide, x1: Math.min(wide.x1, wide.x0 + (s.compact ? 640 : 900)) };
    const full = fits(0.85) ? b : wide;
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
  const mx = s.compact ? 18 : 34, my = s.compact ? 10 : 20;
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

// the talk graph of the open area (same layout on the talk level, so it never moves when a talk is opened)
function fanOf(s: any) {
  const g = s.groups.find((x: any) => x.id === s.areaId);
  if (!g) return null;
  return fanNodes(s, g.talks.map((t: GNode) => t.label), s.compact && s.talkId ? 2 : 1);
}
function fanRightOf(s: any) {
  const f = fanOf(s);
  if (!f || !f.pos.length) return fanBounds(s, 1, 0).x0;
  return Math.max(...f.pos.map((p) => p.x)) + f.w / 2;
}

function clusterGeom(s: any) {
  const m = Math.max(s.people?.length ?? 1, 1);
  const cy = s.H / 2;

  if (s.compact) {
    // phone: people ring centred in the top part of the screen, the bottom sheet takes the rest
    const Hv = s.H * 0.52;
    const rxP = Math.max(150, Math.min(270, s.W / 2 - 150));
    const ryP = Math.max(140, Math.min(320, Hv / 2 - 130));
    const prP = m > 1 ? Math.min(70, Math.max(54, ((rxP + ryP) / 2) * Math.sin(Math.PI / m) * 0.6)) : 70;
    return { tx: s.W / 2, cy: Hv / 2, rxIn: rxP, ryIn: ryP, pr: prP, rxOut: rxP + 170, ryOut: ryP + 140, popLeft: 0, popW: 0, coX0: 0, coX1: 0, pan: 0 };
  }

  // world layout, left to right: talk graph | long edge | people ring | person card | co-author zone
  // positions are fixed; only the camera pan changes with the level
  const rxIn = 260;
  const ryIn = Math.max(190, Math.min(360, s.H / 2 - 130));
  const pr = m > 1 ? Math.min(80, Math.max(58, ((rxIn + ryIn) / 2) * Math.sin(Math.PI / m) * 0.6)) : 80;
  const E = rxIn + 125; // half-width of the ring incl. name labels
  const tx = fanRightOf(s) + 300 + E;
  const cardW = Math.min(620, Math.max(520, s.W * 0.33));
  const cardLeft = tx + E + 50;
  const coX0 = cardLeft + cardW + 80;
  const pan2 = Math.max(0, tx + rxIn + 360 - s.W); // whole people ring (and institutions) in view
  const pan3 = Math.max(pan2, Math.min(coX0 + 730 - s.W, cardLeft - 60)); // card + co-authors in view
  return {
    tx, cy, rxIn, ryIn, pr,
    rxOut: rxIn + 170, ryOut: ryIn + 140, // institution boxes sit outside the ring (hidden once a person is open)
    popLeft: cardLeft, popW: cardW,
    coX0,
    coX1: Math.max(coX0 + 360, Math.min(coX0 + 1000, pan3 + s.W - 30)),
    pan: s.selPersonId ? pan3 : pan2,
  };
}

// where the camera should be (world x of the left edge of the screen)
function panFor(s: any): number {
  if (s.compact || !s.areaId) return 0;
  if (!s.groups.some((g: any) => g.id === s.areaId)) return 0;
  if (s.talkId) return clusterGeom(s).pan;
  const c = camFor(s, 1);
  const px = c.cx + c.R;
  const right = fanRightOf(s);
  const need = s.zoneW ? right + 80 + linkW(s.W) + 30 : right + 40;
  return Math.max(0, Math.min(need - s.W, px - 120));
}

function layout(s: any, cam: any, phi: number) {
  const specs: Spec[] = [];
  const edges: EdgeSpec[] = [];
  const { groups, areaId, talkId } = s;
  const n = groups.length;
  const phase = talkId ? 2 : areaId ? 1 : 0;
  const compactP2 = !!s.compact && phase === 2;
  const hub = { x: cam.cx, y: cam.cy };
  const mk = (o: Partial<Spec>): Spec => ({
    id: "", kind: "main", label: "", x: 0, y: 0, o: 1, r: 0, w: 0, h: 0, from: hub, ...o,
  });

  specs.push(mk({ id: "hub", kind: "hub", label: s.title, x: hub.x, y: hub.y, r: cam.hubR }));

  const pos: Record<string, { x: number; y: number }> = {};
  const gcol: Record<string, string> = {};
  groups.forEach((g: any, i: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n + phi;
    const sel = g.id === areaId;
    const dim = areaId !== null && !sel;
    const x = cam.cx + Math.cos(a) * cam.R;
    const y = cam.cy + Math.sin(a) * cam.R;
    pos[g.id] = { x, y };
    gcol[g.id] = PAL[i % PAL.length];
    specs.push(mk({ id: g.id, kind: "main", label: g.label, x, y, r: cam.nr, o: dim ? 0.3 : 1, sel, dim, n: g.talks.length, color: gcol[g.id] }));
    edges.push({ id: "sp-" + g.id, a: "hub", b: g.id, style: sel ? "hl" : "spoke", o: dim ? 0.12 : sel ? 1 : 0.45, color: gcol[g.id] });
  });

  // links between research areas that share talks (hidden once an area is open)
  const maxS = Math.max(1, ...(s.links ?? []).map((l: any) => l.shared));
  (s.links ?? []).forEach((l: any) => {
    if (!pos[l.a] || !pos[l.b]) return;
    edges.push({ id: `x-${l.a}-${l.b}`, a: l.a, b: l.b, style: "xlink", o: areaId ? 0 : 0.6, w: l.shared / maxS, color: gcol[l.a] });
  });

  // level 2: talks as a radial graph. They stay visible when a talk is opened.
  let fanSel: { x: number; y: number } | null = null as any;
  if (areaId) {
    const g = groups.find((x: any) => x.id === areaId);
    if (g) {
      const fan = fanNodes(s, g.talks.map((t: GNode) => t.label), s.compact && phase === 2 ? 2 : 1);
      g.talks.forEach((t: GNode, j: number) => {
        const f = fan.pos[j];
        if (!f) return;
        const sel = t.id === talkId || t.id === s.linkId;
        const faded = phase === 2 && !sel;
        const id = "s:" + t.id;
        if (sel) fanSel = { x: f.x, y: f.y };
        specs.push(mk({
          id, kind: "sub", label: t.label, x: f.x, y: f.y, w: fan.w, h: fan.hs[j], fs: fan.fs,
          o: compactP2 ? 0 : faded ? 0.75 : 1, sel, from: pos[g.id], color: gcol[g.id],
        }));
        edges.push({ id: `hl-${g.id}-${t.id}`, a: g.id, b: id, style: sel ? "hl" : "sub", o: compactP2 ? 0 : sel ? 1 : faded ? 0.22 : 0.6, color: gcol[g.id] });
      });
      // item without people: an anchor in the free space to the right, joined to the item by an edge
      if (phase === 1 && s.linkId && !s.compact) {
        const li = g.talks.findIndex((t: GNode) => t.id === s.linkId);
        const f = li >= 0 ? fan.pos[li] : null;
        if (f) {
          const cw = linkW(s.W);
          const right = Math.max(...fan.pos.map((q) => q.x)) + fan.w / 2;
          const half = Math.min(250, s.H / 2 - 12);
          const ax = Math.min(right + 80, panFor(s) + s.W - 24 - cw);
          const ay = Math.min(Math.max(f.y, half + 12), s.H - half - 12);
          specs.push(mk({ id: "l:" + s.linkId, kind: "link", label: "", x: ax, y: ay, w: cw, h: 0, from: { x: f.x, y: f.y }, color: gcol[g.id] }));
          edges.push({ id: "lk-" + s.linkId, a: "s:" + s.linkId, b: "l:" + s.linkId, style: "link", o: 1, color: gcol[g.id] });
        }
      }
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

    const fw = 340, ffs = 30;
    const fl = wrapLines(tl, Math.floor((fw - 34) / (ffs * 0.57)), 99).length;
    specs.push(mk({
      id: fid, kind: "focus", label: tl, x: cl.tx, y: cl.cy, w: fw, h: fl * ffs * 1.2 + 48, fs: ffs, sel: true, from: origin, color: gcol[areaId],
    }));
    edges.push({ id: "tf-" + talkId, a: "s:" + talkId, b: fid, style: "link", o: 1, color: gcol[areaId] });

    people.forEach((p, i) => {
      const sel = p.id === s.selPersonId;
      specs.push(mk({
        id: "p:" + p.id, kind: "person", label: p.label,
        x: cl.tx + Math.cos(ang(i)) * cl.rxIn, y: cl.cy + Math.sin(ang(i)) * cl.ryIn,
        r: sel ? cl.pr + 8 : cl.pr, sel, photo: p.d.photo, idx: i, from: { x: cl.tx, y: cl.cy },
        o: s.selPersonId && !sel ? 0.55 : 1, color: PAL[(i + 1) % PAL.length],
      }));
      edges.push({ id: "tp-" + p.id, a: fid, b: "p:" + p.id, style: "person", o: 1, color: PAL[(i + 1) % PAL.length] });
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
        w: w0, h: il * 36 + 30, fs: 29, from: { x: cl.tx, y: cl.cy },
        o: s.selPersonId || s.compact ? 0 : 1,
      }));
      idx.forEach((i) => edges.push({ id: `pi-${label}-${i}`, a: "p:" + people[i].id, b: "i:" + label, style: "inst", o: s.selPersonId || s.compact ? 0 : 0.7 }));
    });

    // co-authors of the selected person: their own graph, joined to the person by an edge,
    // with each co-author's website listed underneath. Opens to the right of the people cluster.
    if (s.selPersonId && s.co?.length && !s.compact) {
      const si = people.findIndex((p) => p.id === s.selPersonId);
      if (si >= 0) {
        const pp = { x: cl.tx + Math.cos(ang(si)) * cl.rxIn, y: cl.cy + Math.sin(ang(si)) * cl.ryIn };
        const x0 = cl.coX0;
        const x1 = Math.max(x0 + 240, cl.coX1);
        const y0 = 40, y1 = s.H - 40;
        const co: GNode[] = s.co;
        const nCo = co.length;
        const w0 = 440, h0 = 340;
        const k = Math.max(0.5, Math.min(1, (x1 - x0 - 10) / w0, Math.sqrt(((x1 - x0) * (y1 - y0)) / (nCo * w0 * h0 * 1.25))));
        const w = w0 * k, h = h0 * k, rr = 70 * k;
        const off = h / 2 - rr - 8; // circle centre -> box centre
        const a0 = Math.atan2((y0 + y1) / 2 - pp.y, (x0 + x1) / 2 - pp.x); // points into the zone, i.e. rightwards
        const per = 4;
        const pts = co.map((_, j) => {
          const ring = Math.floor(j / per), ix = j % per;
          const cnt = Math.min(per, nCo - ring * per);
          const spread = (150 * Math.PI) / 180;
          const th = a0 + (cnt > 1 ? -spread / 2 + (spread * ix) / (cnt - 1) : 0) + (ring % 2 ? 0.12 : 0);
          const d = (400 + ring * 380) * Math.max(k, 0.8);
          return { x: pp.x + Math.cos(th) * d, y: pp.y + Math.sin(th) * d + off };
        });
        const clampC = (p: { x: number; y: number }) => {
          p.x = Math.min(x1 - w / 2, Math.max(x0 + w / 2, p.x));
          p.y = Math.min(y1 - h / 2, Math.max(y0 + h / 2, p.y));
        };
        pts.forEach(clampC);
        for (let it = 0; it < 120; it++) {
          let moved = false;
          for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
              const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
              const ox = w + 40 - Math.abs(dx), oy = h + 30 - Math.abs(dy);
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
          pts.forEach(clampC);
          if (!moved) break;
        }
        pts.forEach((p, j) => {
          const q = co[j];
          const site = siteOf(q.d, q.label);
          let host = "";
          try { host = new URL(site.href).hostname.replace(/^www\./, ""); } catch { host = ""; }
          // keyed by the selected person too, so switching person replaces the whole co-author set
          const id = "a:" + s.selPersonId + ":" + q.id;
          specs.push(mk({
            id, kind: "coauth", label: q.label, x: p.x, y: p.y - off, r: rr, w, h, fs: Math.max(22, 34 * k), idx: j,
            from: pp, photo: q.d.photo, href: site.href, sitelabel: site.found ? host : "Find website",
            pick: people.some((x) => x.id === q.id), pid: q.id, color: PAL[(j + 2) % PAL.length],
          }));
          edges.push({ id: `ca-${s.selPersonId}-${q.id}`, a: "p:" + s.selPersonId, b: id, style: "coa", o: 1, color: PAL[(j + 2) % PAL.length] });
        });
      }
    }
  }
  return { specs, edges };
}

// ---------- small UI ----------
function Avatar({ src, name, size }: { src?: string; name: string; size: number }) {
  const [bad, setBad] = useState(false);
  return (
    <div
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-[24px] bg-black/5 font-semibold text-muted ring-1 ring-black/10"
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

export default function ConferenceResearchStage({ graph, onExit }: { graph: Graph; onExit: () => void }) {
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
    {
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
      .sort((a, b) => b.talks.length - a.talks.length)
      .slice(0, 8);
  }, [nodes, nb]);

  // research areas that share talks (top 12 pairs), used for the dotted cross-links
  const links = useMemo(() => {
    const out: { a: string; b: string; shared: number }[] = [];
    const sets = groups.map((g) => new Set(g.talks.map((t) => t.id)));
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        let c = 0;
        sets[i].forEach((t) => sets[j].has(t) && c++);
        if (c > 0) out.push({ a: groups[i].id, b: groups[j].id, shared: c });
      }
    return out.sort((x, y) => y.shared - x.shared).slice(0, 12);
  }, [groups]);

  const papers = usePersonPapers(); // papers per person id (public/data/person-papers.json)

  // search index: areas, talks, people and research topics, each pointing at an existing spot in the graph
  const searchItems = useMemo(() => {
    const items: SearchItem[] = [];
    const talkArea = new Map<string, { id: string; label: string }>();
    groups.forEach((g) => {
      items.push({ id: "a:" + g.id, kind: "area", label: g.label, sub: `${g.talks.length} talks`, areaId: g.id });
      g.talks.forEach((t) => !talkArea.has(t.id) && talkArea.set(t.id, { id: g.id, label: g.label }));
    });
    const talkItem = new Map<string, SearchItem>();
    talkArea.forEach((ga, tid) => {
      const t = nodes.get(tid)!;
      const it: SearchItem = {
        id: "t:" + tid, kind: "talk", label: t.label, sub: ga.label, areaId: ga.id, talkId: tid,
        keywords: nb(tid, "Topic").map((x) => x.label).join(" "),
      };
      talkItem.set(tid, it);
      items.push(it);
    });
    const seen = new Set<string>();
    talkArea.forEach((ga, tid) => {
      const ps = new Map<string, GNode>();
      nb(tid, "Person").forEach((p) => ps.set(p.id, p));
      if (!ps.size) nb(tid, "Talk").forEach((t) => nb(t.id, "Person").forEach((p) => ps.set(p.id, p)));
      ps.forEach((p) => {
        if (seen.has(p.id)) return;
        seen.add(p.id);
        items.push({
          id: "p:" + p.id, kind: "person", label: p.label, sub: `${nodes.get(tid)!.label} · ${ga.label}`,
          areaId: ga.id, talkId: tid, personId: p.id,
          keywords: nb(p.id, "Institution").map((x) => x.label).join(" "),
        });
      });
    });
    nodes.forEach((n) => {
      if (n.type !== "Topic") return;
      let ts = nb(n.id, "Talk");
      if (!ts.length) {
        const mm = new Map<string, GNode>();
        nb(n.id, "Person").forEach((p) => nb(p.id, "Talk").forEach((t) => mm.set(t.id, t)));
        ts = [...mm.values()];
      }
      const kids = ts.map((t) => talkItem.get(t.id)).filter(Boolean) as SearchItem[];
      if (kids.length) items.push({ id: "r:" + n.id, kind: "topic", label: n.label, sub: `${kids.length} talks`, children: kids });
    });
    // papers written by people in the graph: picking one jumps to its author's card
    const byPaper = new Map<string, SearchItem>();
    items
      .filter((i) => i.kind === "person" && i.personId)
      .forEach((pi) => {
        (papers[pi.personId!] ?? []).forEach((pp) => {
          const ex = byPaper.get(pp.id);
          if (ex) {
            ex.keywords = (ex.keywords ?? "") + " " + pi.label;
            return;
          }
          byPaper.set(pp.id, {
            id: "pp:" + pp.id, kind: "paper", label: pp.t, sub: `${pi.label} · ${pp.track}`,
            areaId: pi.areaId, talkId: pi.talkId, personId: pi.personId, keywords: pi.label,
          });
        });
      });
    byPaper.forEach((v) => items.push(v));
    return items;
  }, [groups, nodes, nb, papers]);

  const [areaId, setAreaId] = useState<string | null>(null);
  const [talkId, setTalkId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null); // item with no people: shows a link popup, graph stays open
  const [sheetMin, setSheetMin] = useState(false); // phone sheet collapsed to its header
  useEffect(() => setSheetMin(false), [personId]);
  const [size, setSize] = useState({ W: 1280, H: 720, sc: 1, cw: 1280 });
  const [, setTick] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<string | null>(null);

  // people attached to an item (directly, or through the talks inside a session)
  const peopleOf = (id: string): GNode[] => {
    const m = new Map<string, GNode>();
    nb(id, "Person").forEach((p) => m.set(p.id, p));
    if (!m.size) nb(id, "Talk").forEach((t) => nb(t.id, "Person").forEach((p) => m.set(p.id, p)));
    return [...m.values()];
  };

  // selected sub area -> people
  const group = groups.find((g) => g.id === areaId) ?? null;
  const talk = talkId ? nodes.get(talkId) ?? null : null;
  // does this area contain items with no people (e.g. workshops)? then keep a free column on the right for their link card
  const hasLinks = useMemo(
    () => !!group && group.talks.some((t) => !nb(t.id, "Person").length && !nb(t.id, "Talk").some((x) => nb(x.id, "Person").length)),
    [group, nb]
  );
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
    // full co-author list (as nodes, so they can be clicked)
    const co = new Map<string, GNode>();
    talksP.forEach((t) => nb(t.id, "Person").forEach((q) => q.id !== p.id && co.set(q.id, q)));
    return {
      insts: insts.length ? insts : p.d.affiliation ? [String(p.d.affiliation)] : [],
      areas: [...areas].slice(0, 10),
      co: [...co.values()],
      role: String(p.d.role ?? talk?.d.talkType ?? (talk?.type === "Session" ? "Participant" : "Speaker")),
    };
  };
  const infos = people.map(infoOf);
  const selPerson = personId ? people.find((p) => p.id === personId) : undefined;
  const selInfo = selPerson ? infos[people.indexOf(selPerson)] : null;

  // mirror state for the animation loop
  const S = useRef<any>({});
  S.current = {
    W: size.W, H: size.H, groups, links, areaId, talkId, linkId, people, infos,
    zoneW: hasLinks && size.cw >= 700 ? linkW(size.W) + 70 : 0,
    selPersonId: selPerson?.id ?? null, pop: !!selPerson, co: selInfo?.co ?? [], title: trunc(String(meta.conference ?? ""), 12),
    talkLabel: talk?.label ?? "",
    compact: size.cw < 700,
  };

  const rt = useRef<any>({
    cur: new Map<string, Cur>(), ecur: new Map<string, number>(),
    last: new Map<string, Spec>(), lastE: new Map<string, EdgeSpec>(),
    specs: [] as Spec[], edges: [] as EdgeSpec[], cam: null as any, phi: 0, speed: 0.16, time: 0, pan: 0,
  });

  // size
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth, ch = el.clientHeight;
      if (cw < 50 || ch < 50) return; // ignore collapsed layouts
      const phone = cw < 700;
      const sc = Math.min(1, cw / (phone ? MIN_W_PHONE : MIN_W), ch / (phone ? MIN_H_PHONE : MIN_H));
      setSize({ W: cw / sc, H: ch / sc, sc, cw });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
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

      // camera pan: the graph never moves, the view slides to the newest level
      const panT = panFor(s);
      r.pan += (panT - r.pan) * (reduce ? 1 : 1 - Math.exp(-dt * 3.5));

      const { specs, edges } = layout(s, r.cam, r.phi);

      // ghosts: keep removed items until they have faded out
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
      r.last = new Map(out.filter((x) => x.o > 0 || (r.cur.get(x.id)?.o ?? 0) > 0.02).map((x) => [x.id, x]));
      r.lastE = new Map(eout.filter((x) => x.o > 0 || (r.ecur.get(x.id) ?? 0) > 0.02).map((x) => [x.id, x]));
      r.specs = out;
      r.edges = eout;
      setTick((n) => (n + 1) % 1e9);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // navigation
  const back = () => {
    if (linkId) setLinkId(null);
    else if (personId) setPersonId(null);
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
    setLinkId(null);
  };
  const pickTalk = (id: string) => {
    setPersonId(null);
    if (peopleOf(id).length === 0) {
      // nothing to expand (e.g. workshops): keep the whole graph, just pop up its link
      setTalkId(null);
      setLinkId((cur) => (cur === id ? null : id));
    } else {
      setLinkId(null);
      setTalkId(id);
    }
  };
  // jump straight to an existing part of the graph
  const pickItem = (it: SearchItem) => {
    if (!it.areaId) return;
    setAreaId(it.areaId);
    const tid = it.kind === "area" ? null : it.talkId ?? null;
    const noPeople = !!tid && it.kind === "talk" && peopleOf(tid).length === 0;
    setTalkId(noPeople ? null : tid);
    setLinkId(noPeople ? tid : null);
    setPersonId(it.kind === "person" || it.kind === "paper" ? it.personId ?? null : null);
  };
  const key = (fn: () => void) => (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && fn();

  // ---------- render ----------
  const r = rt.current;
  const cam = r.cam ?? camFor(S.current.groups ? S.current : { ...S.current, groups }, 0);
  const phase = talkId ? 2 : areaId ? 1 : 0;
  const crumbs = [group?.label, talk?.label].filter(Boolean) as string[];

  const compact = size.cw < 700; // phone: card becomes a bottom sheet
  const popup = phase === 2 && selPerson && selInfo ? (() => {
          const c = r.cur.get("p:" + selPerson.id) as Cur | undefined;
          if (!c) return null;
          const cg = clusterGeom(S.current);
          const left = cg.popLeft;
          const half = Math.min(size.H / 2 - 12, 190);
          const top = Math.min(Math.max(c.y, half + 12), size.H - half - 12);
          const web = siteOf(selPerson.d, selPerson.label, selInfo.insts[0]);
          const prof = urlOf(selPerson.d.profile);
          const li = urlOf(selPerson.d.linkedin);
          const cap = "text-xl font-semibold uppercase tracking-wider text-muted";
          const box = { background: FILL2 } as React.CSSProperties;
          return (
            <div className={compact ? "absolute inset-x-3 bottom-3 z-30" : "absolute z-10"} style={(compact ? { ["--accent" as any]: PAL[(people.indexOf(selPerson) + 1) % PAL.length] } : { left, top, width: cg.popW, transform: "translateY(-50%)", ["--accent" as any]: PAL[(people.indexOf(selPerson) + 1) % PAL.length] }) as React.CSSProperties}>
              <aside
                key={selPerson.id}
                className={`st-anim relative flex flex-col overflow-hidden rounded-[30px] bg-surface/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.28)] ring-1 ring-black/10 backdrop-blur-2xl ${compact ? "p-3 [&_h4]:!text-xl [&_p]:!text-base [&_span]:!text-sm [&_a]:!text-base [&_button]:!text-base" : "p-5"}`}
                style={{ maxHeight: compact ? Math.round(size.H * size.sc * 0.46) : Math.min(size.H - 24, size.H * 0.74), animation: "st-sheet .45s cubic-bezier(0.32,0.72,0,1) both" }}
              >
                <button
                  onClick={() => setPersonId(null)}
                  aria-label="Close"
                  className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-black/10 active:scale-95"
                  style={{ background: FILL }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M4 4l12 12M16 4 4 16" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                  </svg>
                </button>

                {/* header: avatar + name / role / affiliation side by side */}
                {compact && (
                  <button onClick={() => setSheetMin((v) => !v)} aria-label={sheetMin ? "Expand details" : "Collapse details"} className="mx-auto -mt-1 mb-2 flex h-5 w-24 items-center justify-center">
                    <span className="h-1.5 w-12 rounded-full bg-black/25" />
                  </button>
                )}
                <div className="flex items-center gap-4 pr-14">
                  <Avatar src={selPerson.d.photo} name={selPerson.label} size={compact ? 56 : 84} />
                  <div className="min-w-0">
                    <h4 className="truncate text-4xl font-bold leading-tight tracking-tight">{selPerson.label}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="rounded-full bg-accent/20 px-3 py-0.5 text-2xl font-medium text-accent">{selInfo.role}</span>
                      {selInfo.insts.length > 0 && (
                        <span className="truncate text-2xl text-muted">{selInfo.insts.join(" · ")}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`mt-3 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${compact && sheetMin ? "hidden" : ""}`}>
                  {selInfo.co.length > 0 && (
                    <section className="rounded-2xl px-4 py-3" style={box}>
                      <p className={cap}>{/^(workshop|tutorial)/i.test(String(talk?.d.talkType ?? "")) ? "Co-organisers" : "Co-authors"} · {selInfo.co.length}</p>
                      <div className="mt-2 flex max-h-[132px] flex-wrap gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                        {selInfo.co.map((q) => {
                          const inList = people.some((x) => x.id === q.id);
                          const site = siteOf(q.d, q.label);
                          const chip = `rounded-full px-3.5 py-1 font-semibold ${compact ? "text-base" : "text-2xl"}`;
                          return inList ? (
                            <button key={q.id} onClick={() => setPersonId(q.id)} className={`${chip} bg-accent/15 text-accent`}>
                              {q.label}
                            </button>
                          ) : (
                            <a key={q.id} href={site.href} target="_blank" rel="noreferrer" className={`${chip} bg-black/5 text-foreground hover:bg-black/10`}>
                              {q.label} ↗
                            </a>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {selPerson.d.bio && (
                    <p className="mt-3 text-2xl leading-snug text-foreground/90">{shortBio(String(selPerson.d.bio))}</p>
                  )}

                  {(papers[selPerson.id]?.length ?? 0) > 0 && (
                    <section className="mt-3 rounded-2xl px-4 py-3" style={box}>
                      <p className={cap}>Papers · {papers[selPerson.id].length}</p>
                      <ul className="mt-2 flex max-h-[220px] flex-col gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                        {papers[selPerson.id].map((pp) => (
                          <li key={pp.id}>
                            <a href={pp.url} target="_blank" rel="noreferrer" className="block rounded-xl bg-black/5 px-3 py-2 hover:bg-black/10">
                              <span className="block text-2xl font-semibold leading-snug text-foreground">{pp.t}</span>
                              <span className="block text-base text-muted">{pp.track} ↗</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {selInfo.areas.length > 0 && (
                    <section className="mt-3 rounded-2xl px-4 py-3" style={box}>
                      <p className={cap}>Research areas</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selInfo.areas.map((a) => (
                          <span key={a} className="rounded-full bg-accent/15 px-3.5 py-1 text-2xl text-accent">{a}</span>
                        ))}
                      </div>
                    </section>
                  )}

                </div>

                {/* actions pinned at the bottom */}
                <div className={`mt-3 flex gap-3 ${compact && sheetMin ? "hidden" : ""}`}>
                  <a
                    className="flex min-h-[54px] flex-[2] items-center justify-center rounded-2xl bg-accent px-5 text-2xl font-semibold text-white transition-transform active:scale-[0.98]"
                    href={web.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {web.found ? "Visit website ↗" : "Find website ↗"}
                  </a>
                  {prof && prof !== web.href && (
                    <a className="flex min-h-[54px] flex-1 items-center justify-center rounded-2xl bg-accent/15 text-2xl font-semibold text-accent hover:bg-accent/25" href={prof} target="_blank" rel="noreferrer">Profile</a>
                  )}
                  {li && (
                    <a className="flex min-h-[54px] flex-1 items-center justify-center rounded-2xl bg-accent/15 text-2xl font-semibold text-accent hover:bg-accent/25" href={li} target="_blank" rel="noreferrer">LinkedIn</a>
                  )}
                </div>
              </aside>
            </div>
          );
  })() : null;

  // link card for items that have no people: sits in the free column on the right, joined to its node by an edge
  const linkTalk = linkId && phase === 1 ? nodes.get(linkId) ?? null : null;
  const linkPopup = linkTalk ? (() => {
    const lc = r.cur.get("l:" + linkTalk.id) as Cur | undefined;
    if (!compact && !lc) return null;
    const gi = groups.findIndex((g) => g.id === areaId);
    const accent = PAL[(gi < 0 ? 0 : gi) % PAL.length];
    const web = siteOf(linkTalk.d, linkTalk.label, "EMNLP workshop");
    const kindLabel = String(linkTalk.d.talkType ?? linkTalk.type);
    return (
      <div
        className={compact ? "absolute inset-x-3 bottom-3 z-30" : "absolute z-10"}
        style={(compact ? { ["--accent" as any]: accent } : { left: lc!.x, top: lc!.y, width: linkW(size.W), transform: "translateY(-50%)", opacity: Math.min(1, lc!.o * 1.2), ["--accent" as any]: accent }) as React.CSSProperties}
      >
        <aside
          key={linkTalk.id}
          className={`st-anim relative flex flex-col overflow-y-auto rounded-[30px] bg-surface/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.28)] ring-1 ring-black/10 backdrop-blur-2xl ${compact ? "p-3 [&_h4]:!text-xl [&_p]:!text-base [&_span]:!text-sm [&_a]:!text-base" : "p-5"}`}
          style={{ maxHeight: compact ? Math.round(size.H * size.sc * 0.46) : Math.min(size.H - 24, 500), animation: "st-sheet .45s cubic-bezier(0.32,0.72,0,1) both" }}
        >
          <button
            onClick={() => setLinkId(null)}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-black/10 active:scale-95"
            style={{ background: FILL }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 4l12 12M16 4 4 16" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
          </button>
          <span className="w-fit rounded-full bg-accent/20 px-3 py-0.5 text-2xl font-medium text-accent">{kindLabel}</span>
          <h4 className="mt-2 pr-14 text-3xl font-bold leading-tight tracking-tight">{linkTalk.label}</h4>
          <p className="mt-2 text-2xl leading-snug text-muted">
            No speaker details are listed for this item on the official pages.
          </p>
          <a
            className="mt-4 flex min-h-[54px] shrink-0 items-center justify-center rounded-2xl bg-accent px-5 text-2xl font-semibold text-white transition-transform active:scale-[0.98]"
            href={web.href}
            target="_blank"
            rel="noreferrer"
          >
            {web.found ? "Open page ↗" : "Find page ↗"}
          </a>
        </aside>
      </div>
    );
  })() : null;

  return (
    <div className="apple-light flex h-full flex-col bg-background" style={{ fontFamily: FONT, letterSpacing: "-0.011em" }}>
      {/* navigation bar: translucent material, large title, 44pt+ targets */}
      <header className={`z-20 flex flex-wrap items-center border-b border-black/10 bg-surface/80 backdrop-blur-2xl ${compact ? "gap-x-3 gap-y-2 px-3 py-2" : "gap-x-6 gap-y-3 px-8 py-4"}`}>
        <button
          onClick={back}
          className={`flex items-center gap-2 rounded-full bg-accent/15 font-semibold text-accent transition-colors hover:bg-accent/25 active:scale-95 ${compact ? "min-h-[44px] pl-3 pr-4 text-lg" : "min-h-[56px] pl-4 pr-7 text-2xl"}`}
        >
          <svg width="16" height="26" viewBox="0 0 16 26" aria-hidden="true">
            <path d="M13 3 3 13l10 10" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <div className="min-w-0 flex-1">
          <h2 className={`truncate font-bold tracking-tight ${compact ? "text-xl" : "text-4xl"}`}>{meta.conference}</h2>
          <nav aria-label="Breadcrumb" className={`mt-1 flex min-w-0 flex-wrap items-center gap-2 text-muted ${compact ? "text-sm" : "text-2xl"}`}>
            {crumbs.length === 0 && <span>Select a research area</span>}
            {crumbs.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-2">
                {i > 0 && <span aria-hidden="true">›</span>}
                <span className="truncate rounded-full px-4 py-0.5 text-foreground" style={{ background: FILL }}>{c}</span>
              </span>
            ))}
          </nav>
        </div>
        <div className={compact ? "w-full [&>div]:!w-full [&>div]:!min-h-[44px] [&_input]:!text-base [&_[role=option]_span]:!text-base" : "contents"}>
          <ConferenceSearch items={searchItems} onPick={pickItem} />
        </div>
      </header>

      <div
        ref={boxRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 15%, rgba(0,122,255,0.07), transparent 45%), radial-gradient(circle at 85% 90%, rgba(175,82,222,0.06), transparent 45%)",
        }}
      >
      <div className="absolute left-0 top-0" style={{ width: size.W, height: size.H, transform: `translate(${-r.pan * size.sc}px, 0) scale(${size.sc})`, transformOrigin: "0 0" }}>
        <svg width={size.W + WORLD_EXTRA} height={size.H} className="absolute inset-0" role="group" aria-label="Conference graph" style={{ fontFamily: FONT }}>
          <defs>
            <pattern id="st-grid-s" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="rgba(60,60,67,0.16)" strokeWidth="1.6" />
            </pattern>
            <pattern id="st-grid-l" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M200 0H0V200" fill="none" stroke="rgba(60,60,67,0.28)" strokeWidth="2.2" />
            </pattern>
            <filter id="st-shadow" x="-30%" y="-30%" width="160%" height="170%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* background grid, drawn in world space so it is always visible and moves with the graph */}
          <rect width={size.W + WORLD_EXTRA} height={size.H} fill="url(#st-grid-s)" pointerEvents="none" />
          <rect width={size.W + WORLD_EXTRA} height={size.H} fill="url(#st-grid-l)" pointerEvents="none" />

          {/* empty stage: click to close the link popup */}
          <rect width={size.W + WORLD_EXTRA} height={size.H} fill="transparent" onClick={() => setLinkId(null)} />

          {/* edges */}
          {r.edges.map((e: EdgeSpec) => {
            const A = r.cur.get(e.a) as Cur | undefined;
            const B = r.cur.get(e.b) as Cur | undefined;
            if (!A || !B) return null;
            const o = (r.ecur.get(e.id) ?? 0) * Math.min(A.o, B.o);
            if (o < 0.01) return null;
            const flow = e.style === "hl" || e.style === "person" || e.style === "link" || e.style === "coa";
            const accent = flow || e.style === "xlink" || e.style === "sub" || (e.style === "spoke" && !!e.color);
            const curved = e.style === "sub" || e.style === "link" || e.style === "person" || e.style === "inst" || e.style === "coa" || e.id.startsWith("hl-");
            let d = `M${A.x},${A.y} L${B.x},${B.y}`;
            if (curved) {
              const dx = B.x - A.x, dy = B.y - A.y;
              d = `M${A.x},${A.y} Q${(A.x + B.x) / 2 - dy * 0.1},${(A.y + B.y) / 2 + dx * 0.1} ${B.x},${B.y}`;
            }
            if (e.style === "xlink") {
              // bend toward the hub so the cross-links do not cut through the area bubbles
              const hb = r.cur.get("hub") as Cur | undefined;
              const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
              d = `M${A.x},${A.y} Q${hb ? mx + (hb.x - mx) * 0.6 : mx},${hb ? my + (hb.y - my) * 0.6 : my} ${B.x},${B.y}`;
            }
            return (
              <path
                key={e.id}
                d={d}
                fill="none"
                opacity={o}
                style={e.color ? ({ ["--accent" as any]: e.color } as React.CSSProperties) : undefined}
                strokeLinecap="round"
                className={accent ? "stroke-accent" : "stroke-muted"}
                strokeWidth={e.style === "xlink" ? 3 + 9 * (e.w ?? 0) : e.style === "hl" || e.style === "link" ? 5 : e.style === "coa" ? 6.5 : e.style === "person" ? 4 : e.style === "sub" ? 2.5 : 2}
                strokeDasharray={flow ? "18 12" : e.style === "xlink" ? "1 16" : e.style === "co" ? "8 10" : undefined}
                strokeDashoffset={flow ? -r.time * 50 : undefined}
              />
            );
          })}

          {/* nodes */}
          {r.specs.map((sp: Spec) => {
            const c = r.cur.get(sp.id) as Cur | undefined;
            if (!c) return null;
            const common = {
              transform: `translate(${c.x},${c.y})`,
              opacity: c.o,
              style: { pointerEvents: c.o > 0.5 ? "auto" : "none", ...(sp.color ? { ["--accent" as any]: sp.color } : {}) } as React.CSSProperties,
            };
            const glass = "rgba(0,0,0,0.06)";

            if (sp.kind === "hub") {
              return (
                <g key={sp.id} {...common}>
                  <circle r={c.r} className="fill-surface" filter="url(#st-shadow)" />
                  <circle r={c.r} className="fill-accent/20 stroke-accent" strokeWidth={4} />
                  <text y={c.r * 0.12} textAnchor="middle" fontSize={Math.max(26, c.r * 0.34)} fontWeight={700} className="fill-current">
                    {sp.label}
                  </text>
                </g>
              );
            }

            if (sp.kind === "link") return null;

            if (sp.kind === "main") {
              const hov = hoverRef.current === sp.id;
              return (
                <g
                  key={sp.id}
                  {...common}
                  role="button"
                  tabIndex={0}
                  aria-label={`${sp.label}, ${sp.n} talks`}
                  className="st-node cursor-pointer outline-none"
                  onClick={() => pickArea(sp.id)}
                  onKeyDown={key(() => pickArea(sp.id))}
                  onMouseEnter={() => (hoverRef.current = sp.id)}
                  onMouseLeave={() => (hoverRef.current = null)}
                >
                  <g className="st-in">
                    <circle r={c.r} className="fill-surface" filter="url(#st-shadow)" />
                    <circle r={c.r} className={sp.sel ? "fill-accent/35 stroke-accent" : "fill-accent/12 stroke-accent"} strokeWidth={sp.sel ? 6 : hov ? 5 : 3} />
                    <circle r={Math.max(0, c.r - 5)} fill="none" stroke={glass} strokeWidth={1.5} />
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
                    strokeWidth={8}
                    strokeLinejoin="round"
                    className="fill-current stroke-surface"
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
                      strokeWidth={sp.sel ? 5 : 2.5}
                      className={sp.sel ? "fill-accent/40 stroke-accent" : "fill-accent/15 stroke-accent"}
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
              const pr = Math.max(0, c.r - 5);
              const nameLines = wrapLines(sp.label, 14, 2);
              return (
                <g
                  key={sp.id}
                  {...common}
                  role="button"
                  tabIndex={0}
                  aria-label={`${sp.label}, show details`}
                  className="st-node cursor-pointer outline-none"
                  onClick={() => setPersonId((cur) => (cur === sp.id.slice(2) ? null : sp.id.slice(2)))}
                  onKeyDown={key(() => setPersonId((cur) => (cur === sp.id.slice(2) ? null : sp.id.slice(2))))}
                >
                  <clipPath id={`cp${sp.idx}`}>
                    <circle r={pr} />
                  </clipPath>
                  <g className="st-in">
                    <circle r={c.r} className="fill-surface" filter="url(#st-shadow)" />
                    <circle r={c.r} className={sp.sel ? "fill-accent/35 stroke-accent" : "fill-accent/12 stroke-accent"} strokeWidth={sp.sel ? 7 : 3.5} />
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
                      y={c.r + 34 + i * 32}
                      textAnchor="middle"
                      fontSize={28}
                      fontWeight={sp.sel ? 700 : 600}
                      paintOrder="stroke"
                      strokeWidth={9}
                      strokeLinejoin="round"
                      className="fill-current stroke-surface"
                    >
                      {ln}
                    </text>
                  ))}
                </g>
              );
            }

            if (sp.kind === "coauth") {
              const fs = sp.fs ?? 24;
              const nl = wrapLines(sp.label, Math.max(8, Math.floor((c.w - 30) / (fs * 0.6))), 2);
              const pr = Math.max(0, c.r - 3);
              const y0 = c.r + fs * 1.3;
              const click = sp.pick ? () => setPersonId(sp.pid!) : undefined;
              return (
                <g key={sp.id} {...common}>
                  <clipPath id={`cc${sp.idx}`}>
                    <circle r={pr} />
                  </clipPath>
                  <g
                    role={click ? "button" : undefined}
                    tabIndex={click ? 0 : undefined}
                    aria-label={click ? `${sp.label}, show details` : undefined}
                    className={click ? "st-node cursor-pointer outline-none" : undefined}
                    onClick={click}
                    onKeyDown={click ? key(click) : undefined}
                  >
                    <g className="st-in">
                      <circle r={c.r} className="fill-surface" filter="url(#st-shadow)" />
                      <circle r={c.r} className="fill-accent/15 stroke-accent" strokeWidth={click ? 3.5 : 2.5} />
                      <text y={c.r * 0.24} textAnchor="middle" fontSize={c.r * 0.7} fontWeight={600} className="fill-accent">
                        {initials(sp.label)}
                      </text>
                      {sp.photo && (
                        <image
                          href={sp.photo}
                          x={-pr} y={-pr} width={pr * 2} height={pr * 2}
                          clipPath={`url(#cc${sp.idx})`}
                          preserveAspectRatio="xMidYMid slice"
                          {...({ referrerPolicy: "no-referrer" } as any)}
                          onError={(ev) => ((ev.currentTarget as SVGImageElement).style.display = "none")}
                        />
                      )}
                    </g>
                    {nl.map((ln, i) => (
                      <text
                        key={i}
                        y={y0 + i * fs * 1.25}
                        textAnchor="middle"
                        fontSize={fs}
                        fontWeight={600}
                        paintOrder="stroke"
                        strokeWidth={7}
                        strokeLinejoin="round"
                        className="fill-current stroke-surface"
                      >
                        {ln}
                      </text>
                    ))}
                  </g>
                  {sp.href && (
                    <a href={sp.href} target="_blank" rel="noreferrer" className="cursor-pointer outline-none">
                      <text
                        y={y0 + nl.length * fs * 1.25 + fs * 0.45}
                        textAnchor="middle"
                        fontSize={fs * 0.8}
                        fontWeight={500}
                        paintOrder="stroke"
                        strokeWidth={6}
                        strokeLinejoin="round"
                        textDecoration="underline"
                        className="fill-accent stroke-surface"
                      >
                        {trunc(sp.sitelabel ?? "", Math.max(10, Math.floor((c.w - 30) / (fs * 0.8 * 0.6))))} ↗
                      </text>
                    </a>
                  )}
                </g>
              );
            }

            // institution
            const il = wrapLines(sp.label, Math.floor((sp.w - 36) / 16), 3);
            return (
              <g key={sp.id} {...common}>
                <rect x={-sp.w / 2} y={-sp.h / 2} width={sp.w} height={sp.h} rx={22} className="fill-surface" />
                <rect x={-sp.w / 2} y={-sp.h / 2} width={sp.w} height={sp.h} rx={22} className="fill-black/5 stroke-muted" strokeWidth={2} />
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
        {!compact && phase === 0 && (
          <p className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-surface/70 px-10 py-3 text-3xl font-medium text-muted ring-1 ring-black/10 backdrop-blur-xl">
            Select a research area · dotted links join areas that share talks
          </p>
        )}
        {!compact && phase === 1 && !linkId && (
          <p style={{ transform: `translateX(${r.pan}px)` }} className="pointer-events-none absolute bottom-6 right-10 rounded-full bg-surface/70 px-8 py-3 text-3xl font-medium text-muted ring-1 ring-black/10 backdrop-blur-xl">
            Select a talk →
          </p>
        )}
        {phase === 2 && people.length === 0 && (
          <div style={{ transform: `translateX(${r.pan}px)` }} className="absolute bottom-6 right-10 max-w-[44%] rounded-3xl bg-surface/80 px-8 py-5 text-right text-3xl font-medium text-muted ring-1 ring-black/10 backdrop-blur-xl">
            No people are listed for this item on the official pages.
            {talk?.d.url && urlOf(talk.d.url) && !/emnlp\.org/i.test(talk.d.url) && (
              <a className="mt-3 inline-flex min-h-[52px] items-center rounded-2xl bg-accent px-6 text-2xl font-semibold text-white" href={talk.d.url} target="_blank" rel="noreferrer">
                Open its page ↗
              </a>
            )}
          </div>
        )}

        {!compact && (popup ?? linkPopup)}
      </div>
      {compact && (popup ?? linkPopup)}
      </div>
    </div>
  );
}