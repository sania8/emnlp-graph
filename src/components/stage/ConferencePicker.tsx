"use client";
import { useEffect, useState } from "react";
import type { Graph } from "@/lib/graph";

// ConferencePicker: the "Pick a conference" page, centred and styled to match ConferenceStage.
// It is a separate file, so ConferenceStage.tsx does not change at all.

export type Conf = {
  id: string;
  name: string;
  city: string;
  dates: string;
  satellites?: string;
  start?: string; // ISO date, e.g. "2026-10-24"
  end?: string;   // ISO date, e.g. "2026-10-29"
  graph?: Graph;  // when present the card is "ready" and its numbers come from this graph
  accent: string; // e.g. "#007AFF"
};

// Same counting rule as the stage header (countOf in ConferenceStage), so the numbers always match the graph.
export function graphStats(graph: Graph): [string, number][] {
  const c: Record<string, number> = {};
  (graph.elements.nodes as any[]).forEach((n) => {
    c[n.data.type] = (c[n.data.type] ?? 0) + 1;
  });
  return [
    ["People", c.Person ?? 0],
    ["Talks", c.Talk ?? 0],
    ["Topics", c.Topic ?? 0],
  ];
}

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", var(--font-geist-sans), system-ui, sans-serif';
const FILL2 = "rgba(120,120,128,0.16)";

export default function ConferencePicker({ items, onOpen }: { items: Conf[]; onOpen: (id: string) => void }) {
  // read the clock after mount so server and client render the same HTML
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const isLive = (c: Conf) =>
    now !== null && !!c.start && !!c.end && now >= +new Date(c.start) && now <= +new Date(c.end) + 864e5;

  return (
    <main
      className="apple-light grid min-h-full place-items-center bg-background px-6 py-16"
      style={{
        fontFamily: FONT,
        letterSpacing: "-0.011em",
        backgroundImage:
          "radial-gradient(circle at 20% 15%, rgba(0,122,255,0.08), transparent 45%), radial-gradient(circle at 85% 90%, rgba(175,82,222,0.07), transparent 45%)",
      }}
    >
      <div className="w-full max-w-5xl text-center">
        <p className="text-base font-medium text-muted">Conference graphs</p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight sm:text-6xl">Pick a conference to explore</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          See how talks, speakers and research topics connect.
        </p>

        <div className="mt-12 grid gap-6 text-left sm:grid-cols-2">
          {items.map((c) => {
            const ready = !!c.graph;
            const stats = c.graph ? graphStats(c.graph) : null;
            const live = isLive(c);
            return (
              <button
                key={c.id}
                type="button"
                disabled={!ready}
                onClick={() => onOpen(c.id)}
                style={{ ["--accent" as any]: c.accent } as React.CSSProperties}
                className={`group relative flex flex-col overflow-hidden rounded-[30px] bg-surface/90 p-8 text-left ring-1 ring-black/10 backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  ready
                    ? "hover:-translate-y-1 hover:shadow-[0_40px_90px_-30px_rgba(0,0,0,0.35)] active:scale-[0.99]"
                    : "cursor-default opacity-70"
                }`}
              >
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-accent" />

                <div className="flex items-center justify-between">
                  {live ? (
                    <span className="flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                      Live now
                    </span>
                  ) : (
                    <span className="rounded-full px-3 py-1 text-sm font-semibold text-muted" style={{ background: FILL2 }}>
                      {ready ? "Available" : "Upcoming"}
                    </span>
                  )}
                  {ready && (
                    <span aria-hidden="true" className="text-xl text-accent transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  )}
                </div>

                <h2 className="mt-6 text-4xl font-bold tracking-tight">{c.name}</h2>
                <p className="mt-2 text-lg font-medium">{c.city}</p>
                <p className="text-lg text-muted">{c.dates}</p>
                {c.satellites && <p className="mt-1 text-sm text-muted">Satellites: {c.satellites}</p>}

                <div className="mt-8">
                  {stats ? (
                    <dl className="grid grid-cols-3 gap-3">
                      {stats.map(([label, value]) => (
                        <div key={label} className="rounded-2xl px-3 py-3 text-center" style={{ background: FILL2 }}>
                          <dd className="text-3xl font-bold tabular-nums">{value}</dd>
                          <dt className="text-sm text-muted">{label}</dt>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="rounded-2xl px-4 py-4 text-center text-base font-medium text-muted" style={{ background: FILL2 }}>
                      Graph coming soon
                    </p>
                  )}
                </div>

                {ready && (
                  <span className="mt-6 flex min-h-[52px] items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-white">
                    Explore the graph
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------
   Usage (in the page that currently renders the picker):

   import ConferencePicker, { type Conf } from "./ConferencePicker";

   const items: Conf[] = [
     {
       id: "emnlp-2026", name: "EMNLP 2026", city: "Budapest, Hungary",
       dates: "24–29 October 2026", start: "2026-10-24", end: "2026-10-29",
       graph: emnlpGraph, accent: "#007AFF",
     },
     {
       id: "neurips-2026", name: "NeurIPS 2026", city: "Sydney, Australia",
       dates: "6–12 December 2026", satellites: "Atlanta · Paris, 9–13 December",
       accent: "#AF52DE", // no graph yet -> "Upcoming" + "Graph coming soon"
     },
   ];

   <ConferencePicker items={items} onOpen={(id) => setOpenId(id)} />
--------------------------------------------------------------- */