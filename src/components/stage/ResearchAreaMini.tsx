"use client";
import type { Graph } from "@/lib/graph";

// Illustration for the "Research area" tile in ConferenceModePopup.
// Hub in the middle -> one bubble per research area (sized by talks, labelled)
// -> curved links between areas that share talks (thicker = more shared talks).
// Uses the same .cm-node / .cm-flow classes from conference-popup.css, so the animation matches.

export type Area = { label: string; n: number; talks: Set<string> };
export type AreaLink = { a: number; b: number; shared: number };

const PAL = ["#007AFF", "#34C759", "#FF9500", "#FF2D55", "#AF52DE", "#30B0C7", "#FF3B30", "#5856D6"];

// Same rules as clustersOf(graph, "topic") in ConferenceModePopup: a topic's talks are its
// linked talks, or (if none) the talks of the people linked to it. Top 8 areas by talk count.
export function researchAreas(graph: Graph): { areas: Area[]; links: AreaLink[] } {
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

  const areas: Area[] = [...m]
    .map(([label, talks]) => ({ label, n: talks.size, talks }))
    .sort((x, y) => y.n - x.n)
    .slice(0, 8);

  const links: AreaLink[] = [];
  for (let i = 0; i < areas.length; i++)
    for (let j = i + 1; j < areas.length; j++) {
      let shared = 0;
      areas[i].talks.forEach((t) => areas[j].talks.has(t) && shared++);
      if (shared > 0) links.push({ a: i, b: j, shared });
    }
  links.sort((x, y) => y.shared - x.shared);
  return { areas, links: links.slice(0, 12) };
}

const short = (s: string, n = 12) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export default function ResearchAreaMini({ graph, hub }: { graph: Graph; hub: string }) {
  const { areas, links } = researchAreas(graph);
  if (!areas.length) return null;

  const W = 300, H = 210, cx = W / 2, cy = H / 2 - 4, rx = 104, ry = 62;
  const maxN = Math.max(...areas.map((a) => a.n), 1);
  const maxS = Math.max(...links.map((l) => l.shared), 1);

  const pts = areas.map((a, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / areas.length;
    const r = 9 + 9 * Math.sqrt(a.n / maxN);
    return { ...a, i, ang, r, x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry, color: PAL[i % PAL.length] };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto max-h-80 w-full" aria-hidden="true">
      {/* spokes from the hub */}
      {pts.map((o) => (
        <line key={"h" + o.i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke={o.color} strokeWidth={1} opacity={0.25} />
      ))}

      {/* cross-links: areas that share talks */}
      {links.map((l, k) => {
        const p = pts[l.a], q = pts[l.b];
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        const qx = mx + (cx - mx) * 0.45, qy = my + (cy - my) * 0.45; // bend toward the hub
        return (
          <path
            key={"l" + k}
            className="cm-flow"
            d={`M${p.x},${p.y} Q${qx},${qy} ${q.x},${q.y}`}
            fill="none"
            stroke={p.color}
            strokeLinecap="round"
            strokeWidth={0.8 + 2.2 * (l.shared / maxS)}
            opacity={0.55}
          />
        );
      })}

      {/* hub */}
      <circle cx={cx} cy={cy} r={20} fill="var(--color-surface, #fff)" stroke="#007AFF" strokeWidth={2} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="currentColor">{hub}</text>

      {/* area bubbles + labels */}
      {pts.map((o) => (
        <g key={"n" + o.i} transform={`translate(${o.x},${o.y})`}>
          <g className="cm-node" style={{ ["--i" as any]: o.i } as React.CSSProperties}>
            <circle r={o.r} fill="var(--color-surface, #fff)" />
            <circle r={o.r} fill={o.color} fillOpacity={0.16} stroke={o.color} strokeWidth={2} />
            <text y={3.4} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="currentColor">{o.n}</text>
            <text y={o.r + (Math.sin(o.ang) > 0.3 ? 11 : -(o.r + 4))} textAnchor="middle" fontSize={8} fontWeight={600} fill="currentColor" opacity={0.75}>
              {short(o.label)}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}