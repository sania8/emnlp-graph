"use client";

import { motion } from "framer-motion";
import { palette } from "@/lib/palette";

const ACCENT = palette.accent;
const DIM = palette.dim;
const SOFT = palette.soft;

/**
 * Original diagram of the perception layer described in the paper: a
 * fine-tuned YOLOv11n-cls stage producing [component, defect flag, confidence],
 * feeding a frozen Qwen2-VL-2B-Instruct guided by many-shot in-context
 * examples, which together emit the structured visual claim.
 *
 * The convolution stack is drawn schematically — the paper does not publish a
 * layer-by-layer architecture, so no specific channel counts are shown.
 */
export function PerceptionDiagram({ active }: { active: boolean }) {
  const pulse = (delay: number) => ({
    animate: active
      ? { opacity: [0.25, 1, 0.25] }
      : { opacity: 0.35 },
    transition: active
      ? { duration: 2.2, repeat: Infinity, delay, ease: "easeInOut" as const }
      : { duration: 0.4 },
  });

  // Schematic convolution stack: decreasing spatial size, increasing depth.
  const convs = [
    { x: 92, h: 70, w: 9 },
    { x: 106, h: 58, w: 12 },
    { x: 124, h: 46, w: 15 },
    { x: 145, h: 34, w: 18 },
  ];

  return (
    <svg
      viewBox="0 0 730 206"
      className="h-full w-full"
      role="img"
      aria-label="Diagram of the perception layer: a UAV image passes through a fine-tuned YOLO classifier and a frozen vision-language model guided by many-shot examples, producing a structured visual claim"
    >
      <defs>
        <linearGradient id="flow" x1="0" x2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0" />
          <stop offset="50%" stopColor={ACCENT} stopOpacity="0.9" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ---------- 1. UAV image ---------- */}
      <g>
        <rect
          x="16"
          y="64"
          width="54"
          height="54"
          rx="3"
          fill={palette.raised}
          stroke={SOFT}
          strokeWidth="1.2"
        />
        {/* abstract tower glyph */}
        <g stroke={SOFT} strokeWidth="1" fill="none" opacity="0.8">
          <path d="M43 112 L35 80 L51 80 Z" />
          <path d="M30 86 L56 86" />
          <path d="M26 92 L60 92" />
        </g>
        <text
          x="43"
          y="132"
          fill={SOFT}
          fontSize="11.8"
          fontFamily="monospace"
          textAnchor="middle"
        >
          UAV image
        </text>
      </g>

      {/* ---------- 2. YOLO conv stack ---------- */}
      <g>
        <rect
          x="82"
          y="44"
          width="92"
          height="94"
          rx="4"
          fill={palette.panel}
          stroke={DIM}
          strokeWidth="1.2"
        />
        {convs.map((c, i) => (
          <motion.rect
            key={i}
            x={c.x}
            y={91 - c.h / 2}
            width={c.w}
            height={c.h}
            rx="1.5"
            fill={ACCENT}
            fillOpacity="0.14"
            stroke={ACCENT}
            strokeWidth="1"
            {...pulse(i * 0.18)}
          />
        ))}
        <text
          x="128"
          y="38"
          fill={ACCENT}
          fontSize="13.3"
          fontFamily="monospace"
          textAnchor="middle"
        >
          YOLOv11n-cls · fine-tuned
        </text>
        <text
          x="128"
          y="152"
          fill={SOFT}
          fontSize="11.1"
          fontFamily="monospace"
          textAnchor="middle"
        >
          27 component–defect classes
        </text>
      </g>

      {/* YOLO → claim connector */}
      <Connector from={176} to={204} y={91} active={active} />

      {/* ---------- 3. Structured YOLO output ---------- */}
      <g>
        <rect
          x="204"
          y="62"
          width="104"
          height="58"
          rx="4"
          fill={palette.raised}
          stroke={ACCENT}
          strokeWidth="1.2"
          strokeOpacity="0.5"
        />
        {["component", "defect present", "confidence"].map((t, i) => (
          <text
            key={t}
            x="214"
            y={80 + i * 15}
            fill={i === 2 ? ACCENT : SOFT}
            fontSize="11.8"
            fontFamily="monospace"
          >
            {t}
          </text>
        ))}
      </g>

      <Connector from={310} to={336} y={91} active={active} />

      {/* ---------- 4. Many-shot example bank ---------- */}
      <g>
        <rect
          x="336"
          y="16"
          width="104"
          height="42"
          rx="4"
          fill={palette.raised}
          stroke={DIM}
          strokeWidth="1.2"
        />
        <text
          x="388"
          y="32"
          fill={SOFT}
          fontSize="11.8"
          fontFamily="monospace"
          textAnchor="middle"
        >
          many-shot corpus
        </text>
        <text
          x="388"
          y="45"
          fill={ACCENT}
          fontSize="11.8"
          fontFamily="monospace"
          textAnchor="middle"
        >
          85 curated → 8 per query
        </text>
        <motion.path
          d="M388 58 L388 72"
          stroke={ACCENT}
          strokeWidth="1.2"
          strokeDasharray="3 3"
          {...pulse(0.5)}
        />
      </g>

      {/* ---------- 5. Frozen VLM ---------- */}
      <g>
        <rect
          x="336"
          y="72"
          width="104"
          height="66"
          rx="4"
          fill={palette.panel}
          stroke={DIM}
          strokeWidth="1.2"
        />
        {[0, 1, 2].map((i) => (
          <motion.rect
            key={i}
            x={348 + i * 28}
            y="88"
            width="22"
            height="34"
            rx="2"
            fill={ACCENT}
            fillOpacity="0.1"
            stroke={ACCENT}
            strokeWidth="0.9"
            {...pulse(0.3 + i * 0.2)}
          />
        ))}
        <text
          x="388"
          y="150"
          fill={ACCENT}
          fontSize="12.6"
          fontFamily="monospace"
          textAnchor="middle"
        >
          Qwen2-VL-2B · frozen
        </text>
        <text
          x="388"
          y="163"
          fill={SOFT}
          fontSize="9.4"
          fontFamily="monospace"
          textAnchor="middle"
        >
          4-bit NF4 · ≤320 px · no weight updates
        </text>
      </g>

      <Connector from={442} to={468} y={105} active={active} />

      {/* ---------- 6. Structured visual claim ---------- */}
      <g>
        <rect
          x="468"
          y="50"
          width="214"
          height="102"
          rx="4"
          fill={palette.raised}
          stroke={ACCENT}
          strokeWidth="1.4"
        />
        <text x="482" y="70" fill={ACCENT} fontSize="12.2" fontFamily="monospace">
          structured visual claim
        </text>
        {[
          "component",
          "defect status",
          "defect type",
          "confidence",
          "description",
        ].map((t, i) => (
          <text
            key={t}
            x="482"
            y={88 + i * 13}
            fill={SOFT}
            fontSize="11.1"
            fontFamily="monospace"
          >
            · {t}
          </text>
        ))}
      </g>
    </svg>
  );
}

function Connector({
  from,
  to,
  y,
  active,
}: {
  from: number;
  to: number;
  y: number;
  active: boolean;
}) {
  return (
    <g>
      <path
        d={`M${from} ${y} L${to} ${y}`}
        stroke={DIM}
        strokeWidth="1.4"
        fill="none"
      />
      <path
        d={`M${to - 5} ${y - 3} L${to} ${y} L${to - 5} ${y + 3}`}
        stroke={ACCENT}
        strokeWidth="1.2"
        fill="none"
      />
      {active ? (
        <motion.circle
          r="2"
          fill={ACCENT}
          animate={{ cx: [from, to], opacity: [0, 1, 0] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
          cy={y}
        />
      ) : null}
    </g>
  );
}
