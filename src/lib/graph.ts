import { promises as fs } from "fs";
import path from "path";

type El = { data: Record<string, any> };
export type Elements = { nodes: El[]; edges: El[] };
export type Graph = {
  meta: { conference: string; year: number; venue: string; dates: string; generated: string; sources: string[]; counts: Record<string, number> };
  elements: Elements;
};

export async function getGraph(): Promise<Graph | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "public/data/conference-graph.json"), "utf8"));
  } catch {
    return null;
  }
}

/** Small slice for the homepage hero: best-connected people plus the institutions and tracks around them. */
export function heroSubset(g: Graph, n = 60): Elements {
  const deg = new Map<string, number>();
  for (const e of g.elements.edges)
    for (const k of [e.data.source, e.data.target]) deg.set(k, (deg.get(k) ?? 0) + 1);
  const persons = g.elements.nodes
    .filter((x) => x.data.type === "Person")
    .sort((a, b) => (deg.get(b.data.id) ?? 0) - (deg.get(a.data.id) ?? 0))
    .slice(0, n);
  const ids = new Set(persons.map((p) => p.data.id));
  const SHOWN = ["colleague", "affiliated", "chairs", "researches", "coauthor"];
  const hubs = new Map<string, number>();
  g.elements.edges
    .filter((e) => SHOWN.includes(e.data.rel) && ids.has(e.data.source) && !ids.has(e.data.target))
    .forEach((e) => hubs.set(e.data.target, (hubs.get(e.data.target) ?? 0) + 1));
  [...hubs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([id]) => ids.add(id));
  return {
    nodes: g.elements.nodes.filter((x) => ids.has(x.data.id)),
    edges: g.elements.edges.filter((e) => SHOWN.includes(e.data.rel) && ids.has(e.data.source) && ids.has(e.data.target)),
  };
}
