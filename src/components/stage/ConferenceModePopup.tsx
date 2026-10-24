"use client";
import { useMemo } from "react";
import type { Graph } from "@/lib/graph";
import ResearchAreaMini from "./ResearchAreaMini";
import "./conference-popup.css";

// Hover chooser for a conference card: group the graph by programme event or by research area.
// "programme" clusters = Keynotes / Panel / Tutorials / Workshops / Industry / Sessions
// "topic"     clusters = the 8 biggest research areas

export type GroupBy = "programme" | "topic";
type Cluster = { label: string; n: number };

// KEEP IN SYNC with ConferenceStage.tsx (same grouping rules, so the preview matches the real graph)
const PROG: [RegExp, string][] = [
  [/industry/i, "Industry Track"],
  [/keynote/i, "Keynotes"],
  [/panel/i, "Panel"],
  [/tutorial/i, "Tutorials"],
  [/workshop/i, "Workshops"],
  [/bof|birds/i, "Birds of a Feather"],
];
const RANK = ["Keynotes", "Panel", "Tutorials", "Workshops", "Industry Track", "Sessions", "Birds of a Feather"];
const PAL = ["#007AFF", "#34C759", "#FF9500", "#FF2D55", "#AF52DE", "#30B0C7", "#FF3B30", "#5856D6"];
const FILL2 = "rgba(120,120,128,0.16)";
const short = (t: string, n = 13) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

function clustersOf(graph: Graph, by: GroupBy): Cluster[] {
  const nodes = graph.elements.nodes as any[];
  const edges = graph.elements.edges as any[];
  const type = new Map<string, string>(nodes.map((n) => [n.data.id, n.data.type]));
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  edges.forEach((e) => {
    const a = e.data.source, b = e.data.target;
    if (type.has(a) && type.has(b)) {
      add(a, b);
      add(b, a);
    }
  });
  const nb = (id: string, t: string) => [...(adj.get(id) ?? [])].filter((i) => type.get(i) === t);

  const m = new Map<string, Set<string>>();
  const put = (k: string, id: string) => {
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(id);
  };

  if (by === "programme") {
    nodes.forEach(({ data: d }) => {
      if (d.type === "Talk") {
        const raw = String(d.talkType ?? "");
        const hit = PROG.find(([re]) => re.test(raw));
        put(hit ? hit[1] : raw || "Other talks", d.id);
      } else if (d.type === "Session") put("Sessions", d.id);
    });
  } else {
    nodes.forEach(({ data: d }) => {
      if (d.type !== "Topic") return;
      let ts = nb(d.id, "Talk");
      if (!ts.length) {
        const s = new Set<string>();
        nb(d.id, "Person").forEach((p) => nb(p, "Talk").forEach((t) => s.add(t)));
        ts = [...s];
      }
      if (ts.length) m.set(String(d.label), new Set(ts));
    });
  }

  return [...m]
    .map(([label, s]) => ({ label, n: s.size }))
    .sort((a, b) => {
      const ra = RANK.indexOf(a.label), rb = RANK.indexOf(b.label);
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || b.n - a.n;
    })
    .slice(0, 8);
}

// small preview of the real cluster ring: hub in the middle, one bubble per cluster, a few dots for the items inside
function Mini({ items, hub }: { items: Cluster[]; hub: string }) {
  if (!items.length) return null;
  const W = 260, H = 176, cx = W / 2, cy = H / 2, rx = 88, ry = 52;
  const max = Math.max(...items.map((i) => i.n), 1);
  const nodes = items.map((it, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / items.length;
    const r = 10 + 9 * Math.sqrt(it.n / max);
    return { ...it, i, a, r, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, color: PAL[i % PAL.length] };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto max-h-80 w-full" aria-hidden="true">
      {nodes.map((o) => (
        <line key={"e" + o.i} className="cm-flow" x1={cx} y1={cy} x2={o.x} y2={o.y} stroke={o.color} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
      ))}
      <circle cx={cx} cy={cy} r={21} fill="var(--color-surface, #fff)" stroke="#007AFF" strokeWidth={2} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="currentColor">{hub}</text>
      {nodes.map((o) => (
        <g key={"n" + o.i} transform={`translate(${o.x},${o.y})`}>
          <g className="cm-node" style={{ ["--i" as any]: o.i } as React.CSSProperties}>
            <circle r={o.r} fill="var(--color-surface, #fff)" />
            <circle r={o.r} fill={o.color} fillOpacity={0.16} stroke={o.color} strokeWidth={2} />
            <text y={3.6} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="currentColor">{o.n}</text>
            <text y={Math.sin(o.a) > 0.3 ? o.r + 11 : -(o.r + 4)} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="currentColor" opacity={0.75}>{short(o.label)}</text>
          </g>
        </g>
      ))}
    </svg>
  );
}

function Tile({
  title, blurb, items, hub, onPick, mini,
}: {
  title: string; blurb: string; items: Cluster[]; hub: string;
  onPick: (e: React.MouseEvent) => void;
  mini?: React.ReactNode; // custom illustration; falls back to the default ring
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`${title}: ${blurb}`}
      className="cm-tile flex min-w-0 flex-col rounded-3xl p-5 text-left ring-1 ring-black/10 hover:bg-accent/10 hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ background: FILL2 }}
    >
      <span className="text-3xl font-bold tracking-tight">{title}</span>
      <span className="text-lg text-muted">{blurb}</span>
      <span className="mt-3 block">{mini ?? <Mini items={items} hub={hub} />}</span>
    </button>
  );
}

export default function ConferenceModePopup({
  graph, hubLabel, name, pinned, onClose, onPick,
}: {
  graph: Graph;
  hubLabel: string;                       // short text inside the hub bubble, e.g. "EMNLP"
  name: string;                           // e.g. "EMNLP 2026"
  pinned: boolean;                        // true when opened by a tap (touch screens)
  onClose: () => void;
  onPick: (by: GroupBy, e: React.MouseEvent) => void;
}) {
  const byEvent = useMemo(() => clustersOf(graph, "programme"), [graph]);
  const byArea = useMemo(() => clustersOf(graph, "topic"), [graph]);

  return (
    <div
      className="cm-pop rounded-3xl bg-surface/95 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.3)] ring-1 ring-black/10 backdrop-blur-2xl"
      data-open={pinned}
      role="group"
      aria-label={`Explore ${name} by event or by research area`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-2xl font-semibold">Explore {name} by</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cm-close grid h-10 w-10 place-items-center rounded-full text-muted"
          style={{ background: FILL2 }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 4l12 12M16 4 4 16" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Tile title="Event" blurb="Keynotes, tutorials, workshops…" items={byEvent} hub={hubLabel} onPick={(e) => onPick("programme", e)} />
        <Tile
          title="Research area"
          blurb="Agents, LLMs, multilingual…"
          items={byArea}
          hub={hubLabel}
          mini={<ResearchAreaMini graph={graph} hub={hubLabel} />}
          onPick={(e) => onPick("topic", e)}
        />
      </div>
    </div>
  );
}