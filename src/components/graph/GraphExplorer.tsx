"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import cytoscape, { Collection, Core, NodeSingular } from "cytoscape";
// @ts-expect-error no bundled types
import fcose from "cytoscape-fcose";
import { COLORS, PALETTES, buildStyle, type Mode, type NodeType } from "@/lib/graph-style";
import MiniGraph, { type MiniEdge, type MiniNode } from "./MiniGraph";
import type { Graph } from "@/lib/graph";

let registered = false;

type Item = { id: string; label: string; type: NodeType };
type Sel = {
  id: string;
  data: Record<string, any>;
  groups: Record<string, Item[]>;
  degree: number;
  sub: { nodes: MiniNode[]; edges: MiniEdge[] };
};
type Tip = { x: number; y: number; label: string; type: string; sub?: string } | null;

// The first view shows only these; everything else appears when you pick a node.
const OVERVIEW = new Set<string>(["Person", "Topic", "Institution"]);
const TYPES = Object.keys(COLORS) as NodeType[];
const PLURAL: Record<string, string> = {
  Person: "Related researchers",
  Institution: "Institutions",
  Topic: "Topics",
  Talk: "Talks",
  Session: "Sessions",
};
const DESC: Record<string, string> = {
  Person: "Speakers, panelists and organisers",
  Talk: "A keynote, tutorial or workshop",
  Session: "A scheduled slot in the programme",
  Institution: "A university or company",
  Topic: "A research theme",
};

function ShapeIcon({ type, color }: { type: NodeType; color: string }) {
  const shape = {
    Person: <circle cx="9" cy="9" r="6.5" />,
    Talk: <rect x="2.5" y="4" width="13" height="10" rx="3" />,
    Session: <polygon points="9,2 15,5.5 15,12.5 9,16 3,12.5 3,5.5" />,
    Institution: <polygon points="9,2 15.5,7 13,15 5,15 2.5,7" />,
    Topic: <polygon points="9,1.5 16.5,9 9,16.5 1.5,9" />,
  }[type];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill={color} aria-hidden className="shrink-0">
      {shape}
    </svg>
  );
}

const preloaded = new Set<string>();
function preloadPhoto(src?: string) {
  if (!src || preloaded.has(src)) return;
  preloaded.add(src);
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.src = src;
}

function Avatar({ src, name }: { src: string; name: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="relative mt-3 grid h-24 w-24 place-items-center overflow-hidden rounded-lg border border-edge bg-edge/30 text-lg font-semibold text-muted">
      <span className={state === "ok" ? "opacity-0" : state === "loading" ? "animate-pulse" : ""}>{initials}</span>
      {state !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${state === "ok" ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Hubs get more room, leaves sit close to their hub: this is what makes clusters readable.
function layoutOpts(extra: Record<string, unknown> = {}) {
  return {
    name: "fcose",
    quality: "default",
    animate: !reduceMotion(),
    animationDuration: 700,
    animationEasing: "ease-out",
    randomize: false,
    fit: false,
    nodeDimensionsIncludeLabels: false,
    packComponents: true,
    tile: true,
    nodeRepulsion: (n: NodeSingular) => 5500 + (n.data("deg") || 1) * 140,
    idealEdgeLength: (e: any) =>
      55 + 6 * Math.sqrt(Math.max(e.source().data("deg") || 1, e.target().data("deg") || 1)),
    edgeElasticity: () => 0.4,
    gravity: 0.15,
    gravityRange: 3.8,
    numIter: 2500,
    ...extra,
  };
}

function relayout(cy: Core, extra: Record<string, unknown> = {}, done?: () => void) {
  const l = cy.elements(":visible").layout(layoutOpts(extra) as any);
  l.one("layoutstop", () => {
    spreadToAspect(cy);
    done?.();
  });
  l.run();
}

// fcose makes a roughly round blob; on a wide canvas that leaves empty sides.
// Stretch it horizontally to match the canvas shape (only ever spreads nodes apart).
function spreadToAspect(cy: Core) {
  const vis = cy.nodes(":visible");
  if (vis.length < 3) return;
  const bb = vis.boundingBox({});
  const k = Math.min(3.2, cy.width() / cy.height() / (Math.max(bb.w, 1) / Math.max(bb.h, 1)));
  if (k <= 1.05) return;
  const cx = bb.x1 + bb.w / 2;
  vis.positions((n) => {
    const p = n.position();
    return { x: cx + (p.x - cx) * k, y: p.y };
  });
}

// Fit a set of nodes into the canvas.
function focusView(cy: Core, eles: Collection) {
  if (eles.empty()) return;
  const bb = eles.boundingBox({ includeLabels: false, includeOverlays: false });
  const w = cy.width();
  const h = cy.height();
  const pad = 80;
  const z = Math.min(
    1.35,
    Math.max(cy.minZoom(), Math.min(w / (bb.w + pad * 2), h / (bb.h + pad * 2)))
  );
  cy.animate(
    { zoom: z, pan: { x: w / 2 - z * (bb.x1 + bb.w / 2), y: h / 2 - z * (bb.y1 + bb.h / 2) } },
    { duration: reduceMotion() ? 0 : 520, easing: "ease-in-out-cubic" }
  );
}

function spotlight(cy: Core, n: NodeSingular | null) {
  cy.elements().removeClass("faded hl");
  if (!n) return;
  const nb = n.closedNeighborhood().filter(":visible");
  cy.elements().not(nb).addClass("faded");
  nb.addClass("hl");
}

export default function GraphExplorer({
  graph,
  portfolioHref = "/",
}: {
  graph: Graph;
  portfolioHref?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const lockedRef = useRef(false);
  const animatingRef = useRef(true);
  const histRef = useRef<string[]>([]);
  const prevOff = useRef<Set<NodeType> | null>(null);
  const maxDegRef = useRef(2);
  const modeRef = useRef<Mode>("light");
  const closeRef = useRef<HTMLButtonElement>(null);

  const [sel, setSel] = useState<Sel | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [off, setOff] = useState<Set<NodeType>>(new Set());
  const [tip, setTip] = useState<Tip>(null);
  const [canBack, setCanBack] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [more, setMore] = useState<Set<string>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const mode: Mode = "light";
  const [ready, setReady] = useState(false); // layout finished, graph visible
  const [settled, setSettled] = useState(false); // intro animation finished
  const [view, setView] = useState<"overview" | "all">("overview");
  const closeHelp = () => {
    setHelpOpen(false);
    try {
      localStorage.setItem("kg-help-seen", "1");
    } catch {
      /* storage unavailable */
    }
  };
  
  // show the guide automatically on a first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem("kg-help-seen")) setHelpOpen(true);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (!helpOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  const index = useMemo(() => graph.elements.nodes.map((n) => n.data as Item), [graph]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    index.forEach((i) => (c[i.type] = (c[i.type] || 0) + 1));
    return c;
  }, [index]);
  // most connected nodes: quick starting points shown before anything is selected
  const top = useMemo(() => {
    const deg = new Map<string, number>();
    (graph.elements.edges as any[]).forEach((e) => {
      for (const k of [e.data.source, e.data.target]) deg.set(k, (deg.get(k) || 0) + 1);
    });
    return index
      .filter((i) => OVERVIEW.has(i.type))
      .map((i) => ({ ...i, deg: deg.get(i.id) || 0 }))
      .sort((a, b) => b.deg - a.deg)
      .slice(0, 8);
  }, [graph, index]);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return index
      .filter((i) => i.label.toLowerCase().includes(s))
      .sort((a, b) => Number(b.label.toLowerCase().startsWith(s)) - Number(a.label.toLowerCase().startsWith(s)))
      .slice(0, 8);
  }, [q, index]);

  // ---- actions -------------------------------------------------------------
  const clear = () => {
    const cy = cyRef.current;
    lockedRef.current = false;
    cy?.elements().removeClass("faded hl sel");
    setSel(null);
    histRef.current = [];
    setCanBack(false);
    history.replaceState(null, "", location.pathname + location.search);
  };

  const select = (n: NodeSingular, opts: { push?: boolean } = {}) => {
    const cy = cyRef.current!;
    const before = cy.nodes(":visible").length;
    lockedRef.current = true;

    if (n.hasClass("off")) {
      n.removeClass("off");
      const t = n.data("type") as NodeType;
      setOff((s) => {
        const x = new Set(s);
        x.delete(t);
        return x;
      });
    }
    // reveal the part of the graph this node belongs to
    if (n.data("type") === "Person") {
      const talks = n.neighborhood('node[type = "Talk"]');
      talks.union(talks.neighborhood("node")).removeClass("hidden");
    } else n.closedNeighborhood("node").removeClass("hidden");

    cy.nodes().removeClass("sel");
    n.addClass("sel");
    spotlight(cy, n);

    const groups: Sel["groups"] = {};
    n.neighborhood("node").forEach((m) => {
      const d = m.data();
      (groups[d.type] ??= []).push({ id: d.id, label: d.label, type: d.type });
    });
    Object.values(groups).forEach((g) => g.sort((a, b) => a.label.localeCompare(b.label)));

    // the neighbourhood shown in the mini graph (people also include their talks' neighbours)
    let pool = n.closedNeighborhood("node");
    if (n.data("type") === "Person")
      pool = pool.union(n.neighborhood('node[type = "Talk"]').neighborhood("node"));
    const keep = pool
      .not(n)
      .sort((a, b) => (b.data("deg") || 0) - (a.data("deg") || 0))
      .slice(0, 35);
    const subNodes = keep.union(n);
    const subEdges = subNodes.edgesWith(subNodes);
    const sub = {
      nodes: subNodes.map((m) => ({
        data: { id: m.id(), label: m.data("label"), type: m.data("type"), deg: m.data("deg") || 1 },
      })),
      edges: subEdges.map((e) => ({
        data: { id: e.id(), source: e.data("source"), target: e.data("target") },
      })),
    };
    setSel({ id: n.id(), data: n.data(), groups, degree: n.degree(false), sub });
    setBioOpen(false);
    setMore(new Set());
    setTip(null);

    const h = histRef.current;
    if (opts.push !== false && h[h.length - 1] !== n.id()) h.push(n.id());
    setCanBack(h.length > 1);
    history.replaceState(null, "", `#${encodeURIComponent(n.id())}`);

    const go = () => focusView(cy, n.closedNeighborhood().filter(":visible"));
    if (cy.nodes(":visible").length !== before) relayout(cy, {}, go);
    else go();
  };

  const focus = (id: string) => {
    const n = cyRef.current?.getElementById(id);
    if (n && n.nonempty()) select(n as NodeSingular);
    setQ("");
  };

  const back = () => {
    const h = histRef.current;
    if (h.length < 2) return;
    h.pop();
    const n = cyRef.current?.getElementById(h[h.length - 1]);
    if (n && n.nonempty()) select(n as NodeSingular, { push: false });
  };

  const overview = () => {
    setView("overview");
    const cy = cyRef.current!;
    cy.nodes()
      .filter((n) => !OVERVIEW.has(n.data("type")))
      .addClass("hidden");
    clear();
    relayout(cy, {}, () => {
      cy.animate({ fit: { eles: cy.elements(":visible"), padding: 48 } }, { duration: 450 });
    });
  };

  const showAll = () => {
    setView("all");
    const cy = cyRef.current!;
    cy.nodes().removeClass("hidden");
    relayout(cy, {}, () => {
      cy.animate({ fit: { eles: cy.elements(":visible"), padding: 48 } }, { duration: 450 });
    });
  };

  const zoomBy = (f: number) => {
    const cy = cyRef.current!;
    cy.animate(
      { zoom: { level: cy.zoom() * f, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } } },
      { duration: 200 }
    );
  };
  const fit = () => {
    const cy = cyRef.current!;
    cy.animate({ fit: { eles: cy.elements(":visible"), padding: 48 } }, { duration: 400 });
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && hits[active]) focus(hits[active].id);
    else if (e.key === "Escape") setQ("");
  };

  // ---- cytoscape lifecycle -------------------------------------------------
  useEffect(() => {
    if (!box.current) return;
    if (!registered) {
      cytoscape.use(fcose);
      registered = true;
    }
    setReady(false);
    setSettled(false);
    animatingRef.current = true;

    // degree drives node size, label size and layout spacing
    const deg = new Map<string, number>();
    (graph.elements.edges as any[]).forEach((e) => {
      for (const k of [e.data.source, e.data.target]) deg.set(k, (deg.get(k) || 0) + 1);
    });
    const nodes = (graph.elements.nodes as any[]).map((n) => ({
      ...n,
      data: { ...n.data, deg: deg.get(n.data.id) || 1 },
    }));
    const maxDeg = Math.max(2, ...nodes.map((n) => n.data.deg));
    maxDegRef.current = maxDeg;

    const cy = cytoscape({
      container: box.current,
      elements: [...nodes, ...graph.elements.edges] as any,
      style: buildStyle(PALETTES[modeRef.current], maxDeg) as any,
      wheelSensitivity: 0.25,
      minZoom: 0.1,
      maxZoom: 3,
      boxSelectionEnabled: false,
    });
    cyRef.current = cy;

    cy.nodes()
      .filter((n) => !OVERVIEW.has(n.data("type")))
      .addClass("hidden");

    const openHash = () => {
      try {
        const id = decodeURIComponent(location.hash.slice(1));
        if (id) {
          const n = cy.getElementById(id);
          if (n.nonempty()) select(n as NodeSingular);
        }
      } catch {
        /* bad hash, ignore */
      }
    };

    // Intro: lay everything out off-screen, pinch every node into the centre,
    // then let them burst outward (inner nodes first) and settle into place.
    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    const intro = cy.elements(":visible").layout(layoutOpts({ randomize: true, animate: false }) as any);
    intro.one("layoutstop", () => {
      spreadToAspect(cy);
      cy.fit(cy.elements(":visible"), 56);
      const vis = cy.nodes(":visible");
      if (reduceMotion() || vis.length === 0) {
        animatingRef.current = false;
        setReady(true);
        setSettled(true);
        openHash();
        return;
      }
      const finals = new Map<string, { x: number; y: number }>();
      vis.forEach((n) => finals.set(n.id(), { ...n.position() }));
      const bb = vis.boundingBox({});
      const cx = bb.x1 + bb.w / 2;
      const cyy = bb.y1 + bb.h / 2;
      let maxD = 1;
      finals.forEach((p) => (maxD = Math.max(maxD, Math.hypot(p.x - cx, p.y - cyy))));

      vis.positions(() => ({ x: cx, y: cyy })); // the pinch
      setReady(true);

      const PAUSE = 250; // beat to see the single point
      const DUR = 1500;
      const STAGGER = 350;
      vis.forEach((n) => {
        const p = finals.get(n.id())!;
        const delay = PAUSE + (Math.hypot(p.x - cx, p.y - cyy) / maxD) * STAGGER;
        n.delay(delay).animate(
          { position: p },
          { duration: DUR, easing: "spring(200, 18)" as any } // slight overshoot, then settle
        );
      });
      doneTimer = setTimeout(() => {
        animatingRef.current = false;
        setSettled(true);
        openHash();
      }, PAUSE + STAGGER + DUR + 150);
    });
    // let the "Building the graph" message paint before the heavy layout blocks the thread
    const runTimer = setTimeout(() => intro.run(), 60);
    const readyTimer = setTimeout(() => setReady(true), 6000);

    cy.on("tap", "node", (e) => {
      if (!animatingRef.current) select(e.target);
    });
    cy.on("tap", (e) => {
      if (e.target === cy && !animatingRef.current) clear();
    });
    cy.on("mouseover", "node", (e) => {
      if (animatingRef.current) return;
      const n = e.target as NodeSingular;
      if (box.current) box.current.style.cursor = "pointer";
      if (!lockedRef.current) spotlight(cy, n);
      const p = n.renderedPosition();
      const d = n.data();
      preloadPhoto(d.photo);
      setTip({ x: p.x, y: p.y - n.renderedOuterHeight() / 2, label: d.label, type: d.type, sub: d.affiliation });
    });
    cy.on("mouseout", "node", () => {
      if (box.current) box.current.style.cursor = "";
      if (!lockedRef.current) spotlight(cy, null);
      setTip(null);
    });
    cy.on("pan zoom drag", () => setTip(null));

    // links in the highlighted neighbourhood flow from the focused node outward
    let raf = 0;
    let offset = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const es = cy.edges(".hl");
      if (es.empty() || es.length > 150) return;
      offset -= 0.35;
      es.style("line-dash-offset", offset);
    };
    if (!reduceMotion()) raf = requestAnimationFrame(tick);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) clear();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(runTimer);
      clearTimeout(readyTimer);
      clearTimeout(doneTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      cy.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("off");
    off.forEach((t) => cy.nodes(`[type = "${t}"]`).addClass("off"));
    // re-pack after a user toggle (not on first mount)
    if (prevOff.current && prevOff.current !== off) relayout(cy);
    prevOff.current = off;
  }, [off]);

  // ---- render --------------------------------------------------------------
  const d = sel?.data;
  const P = PALETTES[mode];
  const zbtn =
    "grid h-11 w-11 place-items-center rounded-md border border-edge bg-surface/90 text-xl text-muted backdrop-blur transition-colors hover:border-accent/50 hover:text-accent";

  return (
    <div>
      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onSearchKey}
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="kg-hits"
            aria-autocomplete="list"
            placeholder="Search people, institutions, topics, talks"
            className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-base outline-none focus:border-accent"
          />
          {hits.length > 0 && (
            <ul
              id="kg-hits"
              role="listbox"
              className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-edge bg-surface shadow-lg"
            >
              {hits.map((h, i) => (
                <li key={h.id} role="option" aria-selected={i === active}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => focus(h.id)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-base ${i === active ? "bg-edge/50" : ""}`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: P.types[h.type] }} />
                    <span className="truncate">{h.label}</span>
                    <span className="ml-auto shrink-0 text-sm text-muted">{h.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {TYPES.map((t) => (
          <button
            key={t}
            aria-pressed={!off.has(t)}
            onClick={() =>
              setOff((s) => {
                const n = new Set(s);
                n.has(t) ? n.delete(t) : n.add(t);
                return n;
              })
            }
            className={`flex items-center gap-2 whitespace-nowrap rounded-full border border-edge px-4 py-1.5 text-base transition-opacity ${off.has(t) ? "text-muted line-through opacity-50" : ""}`}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: P.types[t] }} />
            {t}
            <span className="text-sm text-muted">{counts[t] ?? 0}</span>
          </button>
        ))}

        <div
          role="group"
          aria-label="Graph view"
          className="ml-auto flex rounded-full border border-edge p-1"
        >
          {(["overview", "all"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={v === "overview" ? overview : showAll}
              className={`whitespace-nowrap rounded-full px-7 py-2.5 text-xl font-medium transition-colors ${
                view === v ? "bg-accent text-white" : "text-muted hover:text-accent"
              }`}
            >
              {v === "overview" ? "Overview" : "Everything"}
            </button>
          ))}
        </div>
      </div>

      {/* graph + details */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_900px]">
        <div
          className="relative h-[70vh] min-h-[520px] overflow-hidden rounded-xl border border-edge lg:h-[72vh] lg:min-h-[520px]"
          style={{ backgroundColor: P.bg, backgroundImage: P.grid, backgroundSize: "100% 100%, 22px 22px" }}
        >
          {!ready && (
            <div className="absolute inset-0 z-20 grid place-items-center text-sm" style={{ color: P.muted }} role="status">
              <button
                onClick={() => setHelpOpen(true)}
                aria-label="How to use"
                className="absolute right-3 top-3 z-20 grid h-14 w-14 place-items-center rounded-full border border-edge bg-surface/90 text-3xl font-semibold text-muted shadow-md backdrop-blur transition-colors hover:border-accent/60 hover:text-accent"
              >
                ?
              </button>
              <span className="animate-pulse">Building the graph…</span>
            </div>
          )}
          <div
            ref={box}
            className={`h-full w-full transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
          />

          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            <button className={zbtn} onClick={() => zoomBy(1.4)} aria-label="Zoom in">+</button>
            <button className={zbtn} onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">−</button>
            <button className={zbtn} onClick={fit} aria-label="Fit graph to view">⤢</button>
          </div>

          {tip && (
            <div
              className="pointer-events-none absolute z-10 max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-md border border-edge bg-surface/95 px-2.5 py-1.5 text-sm shadow-lg backdrop-blur"
              style={{ left: tip.x, top: tip.y - 8 }}
            >
              <p className="font-medium">{tip.label}</p>
              <p className="text-muted">{tip.type}</p>
              {tip.sub && <p className="text-muted">{tip.sub}</p>}
            </div>
          )}

          {/* appears once the graph has settled */}
          
        </div>

        <aside
          aria-live="polite"
          className="min-w-0 overflow-y-auto rounded-xl border border-edge bg-surface p-4 lg:h-[72vh]"
        >
          {!d || !sel ? (
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Start exploring</h2>
              <p className="mt-3 text-lg text-muted">
                Click any node in the graph, or start from one of the most connected below.
              </p>
              <ul className="mt-6 space-y-1.5">
                {top.map((i) => (
                  <li key={i.id}>
                    <button
                      onClick={() => focus(i.id)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-lg transition-colors hover:bg-edge/40"
                    >
                      <ShapeIcon type={i.type} color={P.types[i.type]} />
                      <span className="truncate">{i.label}</span>
                      <span className="ml-auto shrink-0 text-base text-muted">{i.deg} links</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button onClick={() => setHelpOpen(true)} className="mt-6 text-base text-accent hover:underline">
                New to knowledge graphs? Read the guide
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3">
                    {canBack ? (
                      <button onClick={back} className="text-xl font-medium text-accent hover:underline">
                        ← Back
                      </button>
                    ) : (
                      <span />
                    )}
                    <button onClick={clear} className="text-xl text-muted hover:text-accent" aria-label="Close details">
                      Close
                    </button>
                  </div>

                  <p className="mt-3 flex items-center gap-2 text-base text-muted">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: P.types[d.type as NodeType] }} />
                    {d.type}
                    {d.talkType ? `, ${d.talkType}` : ""}
                  </p>

              <h3 className="mt-2 text-2xl font-semibold leading-snug">{d.label}</h3>
              {d.affiliation && <p className="text-base text-muted">{d.affiliation}</p>}
              <p className="mt-1 text-sm text-muted">
                {sel.degree} connection{sel.degree === 1 ? "" : "s"}
              </p>

              <MiniGraph
                key={sel.id}
                nodes={sel.sub.nodes}
                edges={sel.sub.edges}
                centerId={sel.id}
                mode={mode}
                onPick={focus}
              />

              {d.photo && <Avatar key={d.photo} src={d.photo} name={d.label} />}

              {d.bio && (
                <>
                  <p className={`mt-3 text-base text-muted ${bioOpen ? "" : "line-clamp-4"}`}>{d.bio}</p>
                  {d.bio.length > 220 && (
                    <button onClick={() => setBioOpen((o) => !o)} className="mt-1 text-sm text-accent hover:underline">
                      {bioOpen ? "Show less" : "Read more"}
                    </button>
                  )}
                </>
              )}
              {(d.time || d.room) && (
                <p className="mt-2 text-base">{[d.time, d.room && `Room ${d.room}`].filter(Boolean).join(", ")}</p>
              )}
              {d.summary && <p className="mt-2 text-base text-muted">{d.summary}</p>}

              <div className="mt-3 flex flex-wrap gap-3 text-base">
                {d.profile && <a className="text-accent hover:underline" href={d.profile} target="_blank" rel="noreferrer">Official profile</a>}
                {d.linkedin && <a className="text-accent hover:underline" href={d.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
                {d.url && <a className="text-accent hover:underline" href={d.url} target="_blank" rel="noreferrer">Website</a>}
              </div>
              {d.type === "Person" && d.confidence < 0.8 && (
                <p className="mt-3 text-sm text-muted">The official pages list no affiliation for this person.</p>
              )}

              {Object.entries(sel.groups).map(([type, items]) => {
                const all = more.has(type);
                const shown = all ? items : items.slice(0, 8);
                return (
                  <div key={type} className="mt-4">
                    <p className="mb-1 text-sm text-muted">
                      {PLURAL[type] ?? `${type}s`} ({items.length})
                    </p>
                    <ul className="space-y-1">
                      {shown.map((i) => (
                        <li key={i.id}>
                          <button onClick={() => focus(i.id)} className="flex items-start gap-2 text-left text-base hover:text-accent">
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: P.types[i.type] }} />
                            <span>{i.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {items.length > 8 && !all && (
                      <button
                        onClick={() => setMore((s) => new Set(s).add(type))}
                        className="mt-1 text-sm text-accent hover:underline"
                      >
                        Show {items.length - 8} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {helpOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kg-help-title"
        >
          <button
            aria-label="Close guide"
            tabIndex={-1}
            onClick={closeHelp}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-edge bg-surface p-6 shadow-2xl">
            <h2 id="kg-help-title" className="text-xl font-semibold tracking-tight">
              How to read this graph
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This is a knowledge graph, a map of facts. Each shape is a thing, such as a person, a talk or a
              university. Each line is a relationship between two things, such as &ldquo;gives this talk&rdquo; or
              &ldquo;works at&rdquo;. The more connections a node has, the bigger it is.
            </p>

            <h3 className="mt-5 text-sm font-semibold">What the shapes mean</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {TYPES.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm">
                  <ShapeIcon type={t} color={P.types[t]} />
                  <span>
                    <span className="font-medium">{t}</span>
                    {DESC[t] && <span className="block text-xs text-muted">{DESC[t]}</span>}
                  </span>
                </li>
              ))}
            </ul>

            <h3 className="mt-5 text-sm font-semibold">What you can do</h3>
            <ul className="mt-2 space-y-2 text-sm">
              <li><span className="font-semibold">Hover</span> over a node to light up what it connects to. Everything else fades.</li>
              <li><span className="font-semibold">Click</span> a person or topic to see their neighbourhood and details on the right, and to reveal their talks and sessions in the graph.</li>
              <li><span className="font-semibold">Search</span> by name, institution or topic using the box at the top.</li>
              <li><span className="font-semibold">Scroll or pinch</span> to zoom, <span className="font-semibold">drag</span> to pan. Zoom in to see more labels.</li>
              <li><span className="font-semibold">Filter</span> by clicking a coloured chip to hide that kind of node.</li>
              <li><span className="font-semibold">Back</span> returns to your previous selection, and <span className="font-semibold">Overview</span> resets the view.</li>
            </ul>
            <p className="mt-4 text-xs text-muted">
              Tip: copy the address bar to share exactly what you are looking at.
            </p>

            <button
              ref={closeRef}
              onClick={closeHelp}
              className="mt-6 rounded-md border border-accent/60 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10"
            >
              Got it, show me the graph
            </button>
          </div>
        </div>
      )}
    </div>
  );
}