"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { palette } from "@/lib/palette";

const ACCENT = palette.accent;

/** Small live graph motif used as the card's visual, echoing the KG traversal. */
function GraphMotif({ hovered, reduced }: { hovered: boolean; reduced: boolean | null }) {
  const nodes = [
    { x: 22, y: 60, r: 5 },
    { x: 70, y: 28, r: 6 },
    { x: 72, y: 92, r: 5 },
    { x: 122, y: 58, r: 7 },
    { x: 172, y: 30, r: 5 },
    { x: 176, y: 90, r: 6 },
    { x: 220, y: 60, r: 8 },
  ];
  const edges = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [3, 5],
    [4, 6],
    [5, 6],
  ];

  return (
    <svg viewBox="0 0 244 120" className="h-full w-full" aria-hidden>
      {edges.map(([a, b], i) => (
        <g key={i}>
          <line
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke={ACCENT}
            strokeOpacity={hovered ? 0.5 : 0.22}
            strokeWidth="1"
          />
          {hovered && !reduced ? (
            <motion.circle
              r="2"
              fill={ACCENT}
              animate={{
                cx: [nodes[a].x, nodes[b].x],
                cy: [nodes[a].y, nodes[b].y],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                delay: i * 0.14,
                ease: "easeInOut",
              }}
            />
          ) : null}
        </g>
      ))}
      {nodes.map((n, i) => (
        <motion.circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill={palette.panel}
          stroke={ACCENT}
          strokeWidth="1.3"
          initial={false}
          animate={{
            strokeOpacity: hovered ? 1 : 0.45,
            scale: hovered && !reduced ? [1, 1.12, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: hovered && !reduced ? Infinity : 0,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
          style={{ transformOrigin: `${n.x}px ${n.y}px` }}
        />
      ))}
    </svg>
  );
}

export function ResearchCard({
  href,
  venue,
  title,
  blurb,
  role,
  tags,
}: {
  href: string;
  venue: string;
  title: string;
  blurb: string;
  role: string;
  tags: string[];
}) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group relative block overflow-hidden rounded-xl border border-edge bg-surface transition-colors hover:border-accent/50 focus-visible:border-accent/60 focus-visible:outline-none"
    >
      <div className="absolute inset-0 bg-grid opacity-20" />
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent"
        initial={false}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      />

      <div className="relative grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center sm:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[0.96rem] uppercase tracking-[0.2em] text-accent">
              {role}
            </span>
            <span className="font-mono text-[0.96rem] uppercase tracking-[0.2em] text-muted">
              {venue}
            </span>
          </div>

          <h3 className="mt-4 text-2xl font-semibold leading-tight tracking-tight">
            {title}
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            {blurb}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-edge px-2.5 py-1 font-mono text-[0.96rem] uppercase tracking-wider text-muted"
              >
                {t}
              </span>
            ))}
          </div>

          <span className="mt-6 inline-flex items-center gap-1.5 text-sm text-accent">
            Open the simulation
            <motion.span
              aria-hidden
              initial={false}
              animate={{ x: hovered && !reduced ? 4 : 0 }}
              transition={{ duration: 0.3 }}
            >
              →
            </motion.span>
          </span>
        </div>

        <div className="h-28 rounded-lg border border-edge bg-surface-raised p-2 sm:h-32">
          <GraphMotif hovered={hovered} reduced={reduced} />
        </div>
      </div>
    </Link>
  );
}
