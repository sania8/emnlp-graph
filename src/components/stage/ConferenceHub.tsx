"use client";
import { useEffect, useMemo, useState } from "react";
import type { Graph } from "@/lib/graph";
import ConferenceStage from "./ConferenceStage";
import ConferenceResearchStage from "./ConferenceResearchStage";
import ConferenceModePopup, { type GroupBy } from "./ConferenceModePopup";
import "./conference.css";

// EMNLP 2026 runs 24-29 October 2026 (used for the "Live now" badge)
const EMNLP_START = "2026-10-24";
const EMNLP_END = "2026-10-29";

// set to true to show the People / Talks / Topics numbers on the EMNLP card
const SHOW_STATS = false;

const FILL2 = "rgba(120,120,128,0.16)"; // same secondary fill the stage uses

export default function ConferenceHub({ graph }: { graph: Graph | null }) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [now, setNow] = useState<number | null>(null);
  const [by, setBy] = useState<GroupBy>("programme"); // how the graph is clustered: by event or by research area
  const [pinned, setPinned] = useState(false); // touch screens: popup opened by a tap instead of a hover
  const meta = graph?.meta as any;

  const openWith = (mode: GroupBy, x: number, y: number) => {
    setBy(mode);
    setOrigin({ x, y });
    setPinned(false);
    setOpen(true);
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // read the clock after mount so server and client render the same HTML
  useEffect(() => setNow(Date.now()), []);
  const live = now !== null && now >= +new Date(EMNLP_START) && now <= +new Date(EMNLP_END) + 864e5;

  // counted from the graph itself, so the numbers always match what the stage can show.
  // "People" = people linked to at least one talk (committee members without a talk are not counted).
  const stats: [string, number][] = useMemo(() => {
    if (!graph) return [];
    const nodes = graph.elements.nodes as any[];
    const edges = graph.elements.edges as any[];
    const type = new Map<string, string>(nodes.map((n) => [n.data.id, n.data.type]));
    const speakers = new Set<string>();
    edges.forEach((e) => {
      const a = e.data.source, b = e.data.target;
      if (type.get(a) === "Person" && type.get(b) === "Talk") speakers.add(a);
      if (type.get(b) === "Person" && type.get(a) === "Talk") speakers.add(b);
    });
    const count = (t: string) => nodes.filter((n) => n.data.type === t).length;
    return [
      ["People", speakers.size],
      ["Talks", count("Talk")],
      ["Topics", count("Topic")],
    ];
  }, [graph]);

  return (
    <div className="apple-light">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[120rem] flex-col justify-center px-8 py-12 text-center">
        <p className="text-2xl font-medium text-muted">Conference graphs</p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight sm:text-6xl">Pick a conference to explore</h1>
        <p className="mx-auto mt-3 max-w-3xl text-3xl text-muted">
          See how talks, speakers and research topics connect.
        </p>

        <div className="mt-10 grid gap-8 text-left lg:grid-cols-2">
          {/* EMNLP */}
          {graph ? (
            <div className="cm-wrap">
              <button
                onClick={(e) => {
                  // touch screens cannot hover: a tap shows the chooser. Mouse users open the default view (by event).
                  if (window.matchMedia("(hover: none)").matches) setPinned((p) => !p);
                  else openWith("programme", e.clientX, e.clientY);
                }}
                className="group relative flex h-full w-full min-h-[24rem] flex-col justify-between overflow-hidden rounded-3xl bg-surface p-8 text-left shadow-[0_2px_20px_-8px_rgba(0,0,0,0.18)] ring-1 ring-black/5 transition-all duration-500 hover:shadow-[0_24px_70px_-24px_rgba(0,122,255,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-2 bg-accent" />
                <div>
                  {live ? (
                    <span className="inline-flex items-center gap-3 rounded-full bg-accent/15 px-5 py-1.5 text-2xl font-medium text-accent">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                      Live now
                    </span>
                  ) : (
                    <span className="inline-block rounded-full px-5 py-1.5 text-2xl font-medium text-muted" style={{ background: FILL2 }}>
                      Available
                    </span>
                  )}
                  <h2 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl">
                    {meta.conference}
                  </h2>
                  <p className="mt-4 text-2xl text-accent">{meta.venue}</p>
                  <p className="mt-1 text-2xl text-muted">{meta.dates}</p>
                </div>
                {SHOW_STATS && (
                  <dl className="mt-8 grid grid-cols-3 gap-4">
                    {stats.map(([l, v]) => (
                      <div key={l} className="rounded-2xl px-4 py-4 text-center" style={{ background: FILL2 }}>
                        <dd className="text-4xl font-bold tabular-nums xl:text-5xl">{v}</dd>
                        <dt className="mt-1 text-xl text-muted">{l}</dt>
                      </div>
                    ))}
                  </dl>
                )}
                <span className="mt-6 flex min-h-[60px] items-center justify-center rounded-2xl bg-accent text-2xl font-semibold text-white transition-transform duration-300 group-hover:scale-[1.01]">
                  Explore the graph
                </span>
              </button>
              <ConferenceModePopup
                graph={graph}
                hubLabel={String(meta.conference ?? "").replace(/\s*\d{4}$/, "")}
                name={String(meta.conference ?? "")}
                pinned={pinned}
                onClose={() => setPinned(false)}
                onPick={(mode, e) => openWith(mode, e.clientX, e.clientY)}
              />
            </div>
          ) : (
            <div className="rounded-3xl bg-surface p-8 text-2xl ring-1 ring-black/5">
              No dataset yet. Run <code>npm run kg</code>, then reload.
            </div>
          )}

          {/* NeurIPS */}
          <div
            aria-disabled
            style={{ ["--accent" as any]: "#AF52DE" } as React.CSSProperties}
            className="flex min-h-[24rem] flex-col justify-between rounded-3xl border-2 border-dashed border-edge bg-transparent p-8"
          >
            <div>
              <span className="inline-block rounded-full bg-accent/12 px-5 py-1.5 text-2xl font-medium text-accent">
                Upcoming
              </span>
              <h2 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl">NeurIPS 2026</h2>
              <p className="mt-4 text-2xl text-accent">Sydney, Australia</p>
              <p className="mt-1 text-2xl text-muted">6–12 December 2026</p>
              <p className="mt-3 text-xl text-muted">Satellites: Atlanta · Paris, 9–13 December</p>
            </div>
            <p className="mt-6 rounded-2xl px-6 py-5 text-center text-2xl font-medium text-muted" style={{ background: FILL2 }}>
              Graph coming soon
            </p>
          </div>
        </div>
      </div>

      <footer className="mx-auto w-full max-w-[120rem] px-8 pb-12 pt-2">
        <div className="flex flex-col items-center gap-5 border-t border-black/10 pt-8 text-center lg:flex-row lg:justify-center lg:gap-10">
          <p className="text-base text-muted lg:whitespace-nowrap lg:text-[clamp(0.85rem,1.1vw,1.4rem)]">
            Built by <span className="font-semibold text-foreground">Sania Verma</span>, M.Sc. in AI, City St George’s, University of London
          </p>
          <div className="flex shrink-0 items-center gap-4">
            <a
              href="https://github.com/sania8"
              target="_blank"
              rel="noreferrer"
              aria-label="Sania Verma on GitHub"
              className="grid h-11 w-11 place-items-center rounded-full text-foreground transition-transform duration-300 hover:-translate-y-1 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ background: FILL2 }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.3-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.876.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/sania-verma-146514231/"
              target="_blank"
              rel="noreferrer"
              aria-label="Sania Verma on LinkedIn"
              className="grid h-11 w-11 place-items-center rounded-full text-foreground transition-transform duration-300 hover:-translate-y-1 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ background: FILL2 }}
            >
              <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>

      {open && graph && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-background"
          style={
            {
              "--ox": `${origin.x}px`,
              "--oy": `${origin.y}px`,
              animation: "st-in .9s cubic-bezier(0.22,1,0.36,1) both",
            } as React.CSSProperties
          }
        >
          {by === "topic" ? (
            <ConferenceResearchStage graph={graph} onExit={() => setOpen(false)} />
          ) : (
            <ConferenceStage graph={graph} onExit={() => setOpen(false)} />
          )}
        </div>
      )}
    </div>
  );
}