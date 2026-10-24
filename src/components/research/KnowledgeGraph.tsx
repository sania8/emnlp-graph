"use client";

import { motion } from "framer-motion";
import { palette } from "@/lib/palette";

const ACCENT = palette.accent;
const DIM = palette.dim;
const SOFT = palette.soft;
const WARN = palette.warn;

type Node = {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  /** Hop at which the node enters during the multi-hop traversal. */
  hop: number;
};

type Edge = {
  from: string;
  to: string;
  rel: string;
  hop: number;
  /**
   * Vertical offset for the relation label, measured from the edge midpoint.
   * The default lifts it clear above the node boxes; a positive value drops it
   * below instead, for edges whose midpoint lands on top of another node.
   */
  dy?: number;
};

const LABEL_DY = -22;

/**
 * Multi-hop traversal through the Power-Line O&M knowledge graph, drawn with
 * the node classes and relation names defined in the paper's ontology
 * (Table 2). The path shown is the corroded Stockbridge damper case study.
 */
const NODES: Node[] = [
  { id: "image", label: "Image", type: "Evidence", x: 70, y: 150, hop: 0 },
  {
    id: "component",
    label: "stockbridge_damper",
    type: "ComponentType",
    x: 235,
    y: 150,
    hop: 0,
  },
  { id: "asset", label: "500 kV STN", type: "Asset", x: 235, y: 56, hop: 1 },
  {
    id: "defect",
    label: "corrosion",
    type: "DefectType",
    x: 410,
    y: 215,
    hop: 1,
  },
  {
    id: "standard",
    label: "IEC 61284",
    type: "Standard",
    x: 410,
    y: 300,
    hop: 2,
  },
  {
    id: "severity",
    label: "severity 2",
    type: "Severity",
    x: 585,
    y: 150,
    hop: 2,
  },
  {
    id: "failure",
    label: "mechanical failure",
    type: "FailureMode",
    x: 585,
    y: 56,
    hop: 3,
  },
  {
    id: "risk",
    label: "conductor drop · 0.95",
    type: "Risk",
    x: 760,
    y: 56,
    hop: 3,
  },
  {
    id: "action",
    label: "hardware replacement",
    type: "MaintenanceAction",
    x: 760,
    y: 150,
    hop: 4,
  },
  {
    id: "template",
    label: "WorkOrderTemplate",
    type: "WorkOrder",
    x: 760,
    y: 300,
    hop: 4,
  },
];

const EDGES: Edge[] = [
  { from: "image", to: "component", rel: "HAS_COMPONENT", hop: 0 },
  { from: "component", to: "asset", rel: "PART_OF", hop: 1 },
  // Midpoint sits under the component node, so drop the label below the line.
  { from: "image", to: "defect", rel: "HAS_DEFECT", hop: 1, dy: 20 },
  { from: "defect", to: "severity", rel: "HAS_SEVERITY", hop: 2 },
  { from: "component", to: "standard", rel: "CONFORMS_TO", hop: 2 },
  { from: "severity", to: "failure", rel: "LEADS_TO", hop: 3 },
  { from: "failure", to: "risk", rel: "IMPACTS", hop: 3 },
  // Midpoint lands on the severity node, so this one drops below too.
  { from: "defect", to: "action", rel: "REQUIRES @severity", hop: 4, dy: 26 },
  { from: "action", to: "template", rel: "IMPLEMENTS", hop: 4 },
];

const byId = (id: string) => NODES.find((n) => n.id === id)!;

export function KnowledgeGraph({
  hop,
  reduced,
}: {
  /** How many hops of the traversal to reveal; -1 shows nothing lit. */
  hop: number;
  reduced: boolean | null;
}) {
  return (
    <svg
      viewBox="-20 -14 940 390"
      className="h-full w-full"
      role="img"
      aria-label="Knowledge graph traversal from an inspection image through component, defect, severity, failure mode and risk, to the required maintenance action and work order template"
    >
      {/* Edges */}
      {EDGES.map((e) => {
        const a = byId(e.from);
        const b = byId(e.to);
        const on = hop >= e.hop;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return (
          <g key={`${e.from}-${e.to}`}>
            <motion.line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={on ? ACCENT : DIM}
              strokeWidth={on ? 1.5 : 1}
              initial={false}
              animate={{ opacity: on ? 0.85 : 0.4 }}
              transition={{ duration: reduced ? 0 : 0.45 }}
            />
            <motion.text
              x={mid.x}
              y={mid.y + (e.dy ?? LABEL_DY)}
              fill={on ? ACCENT : palette.soft}
              fontSize="11.1"
              fontFamily="monospace"
              textAnchor="middle"
              initial={false}
              animate={{ opacity: on ? 1 : 0.35 }}
              transition={{ duration: reduced ? 0 : 0.45 }}
            >
              {e.rel}
            </motion.text>
            {on && !reduced ? (
              <motion.circle
                r="2.5"
                fill={ACCENT}
                animate={{ cx: [a.x, b.x], cy: [a.y, b.y], opacity: [0, 1, 0] }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  delay: e.hop * 0.2,
                  ease: "easeInOut",
                }}
              />
            ) : null}
          </g>
        );
      })}

      {/* Nodes */}
      {NODES.map((n) => {
        const on = hop >= n.hop;
        const isRisk = n.type === "Risk";
        const colour = on ? (isRisk ? WARN : ACCENT) : SOFT;
        const w = Math.max(n.label.length * 8.1 + 26, 100);
        return (
          <motion.g
            key={n.id}
            initial={false}
            animate={{ opacity: on ? 1 : 0.3, scale: on ? 1 : 0.94 }}
            transition={{ duration: reduced ? 0 : 0.45 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          >
            <rect
              x={n.x - w / 2}
              y={n.y - 17}
              width={w}
              height={34}
              rx="6"
              fill={palette.panel}
              stroke={colour}
              strokeWidth={on ? 1.5 : 1}
            />
            <text
              x={n.x}
              y={n.y - 4}
              fill={colour}
              fontSize="9.6"
              fontFamily="monospace"
              textAnchor="middle"
              opacity="0.75"
            >
              {n.type}
            </text>
            <text
              x={n.x}
              y={n.y + 8}
              fill={on ? palette.text : SOFT}
              fontSize="12.6"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {n.label}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}
