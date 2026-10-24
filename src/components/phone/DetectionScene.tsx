"use client";

import { motion } from "framer-motion";
import { palette } from "@/lib/palette";

/**
 * An original schematic illustration of a single surveillance frame.
 *
 * Nothing here is traced from or derived from real footage — it is a diagram
 * drawn to explain what each pipeline stage adds. The genuine detector output
 * is shown separately as video elsewhere on the page.
 */
export type SceneFlags = {
  /** Loose, over-eager boxes from the pre-trained baseline. */
  baselineBoxes: boolean;
  /** Spurious detections the baseline raised on background objects. */
  falsePositives: boolean;
  /** Tightened person and phone boxes after fine-tuning. */
  refinedBoxes: boolean;
  /** MediaPipe hand landmark skeleton. */
  landmarks: boolean;
  /** Geometric relationship drawn between hand and phone. */
  spatial: boolean;
  /** Final positive decision badge. */
  decided: boolean;
};

const ACCENT = palette.accent;
const WARN = palette.danger;
const SOFT = palette.soft;

export function DetectionScene({
  flags,
  reduced,
}: {
  flags: SceneFlags;
  reduced: boolean | null;
}) {
  const fade = (visible: boolean, delay = 0) => ({
    initial: false as const,
    animate: { opacity: visible ? 1 : 0 },
    transition: { duration: reduced ? 0 : 0.45, delay: visible ? delay : 0 },
  });

  return (
    <svg
      viewBox="0 0 400 240"
      className="h-full w-full"
      role="img"
      aria-label="Schematic of a surveillance frame showing a person holding a phone, with detection boxes and hand landmarks"
    >
      {/* ---------- Static scene ---------- */}
      <rect width="400" height="240" fill={palette.canvas} />

      {/* Room geometry */}
      <g stroke={palette.dim} strokeWidth="1.5" fill="none">
        <path d="M0 170 L400 150" />
        <path d="M30 40 L30 175" />
        <path d="M370 30 L370 155" />
      </g>

      {/* Counter and equipment, kept deliberately abstract */}
      <g fill={palette.raised} stroke={palette.dim} strokeWidth="1.5">
        <rect x="46" y="142" width="150" height="46" rx="2" />
        <rect x="300" y="62" width="64" height="104" rx="3" />
        <rect x="222" y="150" width="54" height="34" rx="2" />
      </g>
      <g stroke={palette.dim} strokeWidth="1.2">
        <path d="M300 112 L364 108" />
        <path d="M332 62 L332 166" />
      </g>

      {/* Trays on the counter */}
      <g fill={palette.raised} stroke={palette.dim} strokeWidth="1">
        <rect x="58" y="138" width="34" height="12" rx="1.5" />
        <rect x="100" y="136" width="30" height="12" rx="1.5" />
      </g>

      {/* ---------- Person ---------- */}
      <g>
        {/* head */}
        <circle cx="168" cy="96" r="11" fill={palette.raised} stroke={SOFT} strokeWidth="1.4" />
        {/* torso */}
        <path
          d="M156 110 Q168 104 180 110 L183 152 Q168 157 153 152 Z"
          fill={palette.raised}
          stroke={SOFT}
          strokeWidth="1.4"
        />
        {/* legs */}
        <g stroke={SOFT} strokeWidth="1.4" fill="none">
          <path d="M160 153 L158 186" />
          <path d="M176 153 L179 186" />
        </g>
        {/* arm raised towards the phone */}
        <path
          d="M180 116 Q196 112 202 101"
          stroke={SOFT}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* Phone in hand */}
      <rect
        x="200"
        y="88"
        width="11"
        height="18"
        rx="2"
        fill={palette.raised}
        stroke={SOFT}
        strokeWidth="1.2"
      />

      {/* ---------- Stage 2: baseline boxes (loose) ---------- */}
      <motion.g {...fade(flags.baselineBoxes)}>
        <rect
          x="140"
          y="76"
          width="78"
          height="122"
          fill="none"
          stroke={SOFT}
          strokeWidth="1.6"
          strokeDasharray="5 4"
        />
        <text x="140" y="70" fill={SOFT} fontSize="11.8" fontFamily="monospace">
          person ?
        </text>
      </motion.g>

      {/* ---------- Stage 2: false alerts ---------- */}
      <motion.g
        initial={false}
        animate={{ opacity: flags.falsePositives ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : 0.45 }}
      >
        {[
          { x: 306, y: 96, w: 24, h: 16 },
          { x: 62, y: 134, width: 0, w: 28, h: 14 },
          { x: 232, y: 156, w: 22, h: 14 },
        ].map((b, i) => (
          <motion.g
            key={i}
            animate={
              reduced || !flags.falsePositives
                ? undefined
                : { opacity: [1, 0.25, 1] }
            }
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut",
            }}
          >
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill="none"
              stroke={WARN}
              strokeWidth="1.4"
            />
            <text
              x={b.x}
              y={b.y - 3}
              fill={WARN}
              fontSize="10.4"
              fontFamily="monospace"
            >
              phone ?
            </text>
          </motion.g>
        ))}
      </motion.g>

      {/* ---------- Stage 3: refined boxes ---------- */}
      <motion.g {...fade(flags.refinedBoxes)}>
        <rect
          x="148"
          y="82"
          width="42"
          height="110"
          fill="none"
          stroke={ACCENT}
          strokeWidth="1.6"
        />
        <text x="148" y="77" fill={ACCENT} fontSize="11.8" fontFamily="monospace">
          person
        </text>
        <rect
          x="196"
          y="84"
          width="20"
          height="26"
          fill="none"
          stroke={ACCENT}
          strokeWidth="1.6"
        />
        <text x="218" y="92" fill={ACCENT} fontSize="11.8" fontFamily="monospace">
          phone
        </text>
      </motion.g>

      {/* ---------- Stage 4: hand landmarks ---------- */}
      <motion.g {...fade(flags.landmarks)}>
        <g stroke={ACCENT} strokeWidth="1" opacity="0.75" fill="none">
          <path d="M196 112 L200 104 L203 97" />
          <path d="M196 112 L203 106 L207 100" />
          <path d="M196 112 L206 109 L211 104" />
          <path d="M196 112 L205 114 L211 112" />
        </g>
        {[
          [196, 112],
          [200, 104],
          [203, 97],
          [203, 106],
          [207, 100],
          [206, 109],
          [211, 104],
          [205, 114],
          [211, 112],
        ].map(([cx, cy], i) => (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r="1.8"
            fill={ACCENT}
            initial={false}
            animate={{ opacity: flags.landmarks ? 1 : 0 }}
            transition={{
              duration: reduced ? 0 : 0.3,
              delay: flags.landmarks && !reduced ? i * 0.05 : 0,
            }}
          />
        ))}
        <text x="186" y="128" fill={ACCENT} fontSize="10.4" fontFamily="monospace">
          hand landmarks
        </text>
      </motion.g>

      {/* ---------- Stage 5: spatial relationship ---------- */}
      <motion.g {...fade(flags.spatial)}>
        <motion.path
          d="M203 108 L206 97"
          stroke={ACCENT}
          strokeWidth="1.2"
          strokeDasharray="3 3"
          fill="none"
          initial={false}
          animate={{ pathLength: flags.spatial ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.6 }}
        />
        <rect
          x="196"
          y="92"
          width="18"
          height="20"
          fill={ACCENT}
          opacity="0.18"
        />
        <text x="222" y="112" fill={ACCENT} fontSize="10.4" fontFamily="monospace">
          hand ∩ phone
        </text>
      </motion.g>

      {/* ---------- Stage 7: decision ---------- */}
      <motion.g
        initial={false}
        animate={{ opacity: flags.decided ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : 0.5 }}
      >
        <rect
          x="14"
          y="14"
          width="146"
          height="22"
          rx="4"
          fill={palette.panel}
          stroke={ACCENT}
          strokeWidth="1.2"
        />
        <circle cx="27" cy="25" r="4" fill={ACCENT} />
        <text x="37" y="28.5" fill={ACCENT} fontSize="13.3" fontFamily="monospace">
          PHONE USAGE DETECTED
        </text>
      </motion.g>

      {/* Frame furniture */}
      <rect
        x="0.75"
        y="0.75"
        width="398.5"
        height="238.5"
        fill="none"
        stroke={palette.dim}
        strokeWidth="1.5"
      />
      <text
        x="392"
        y="232"
        fill={palette.soft}
        fontSize="9.5"
        fontFamily="monospace"
        textAnchor="end"
      >
        SCHEMATIC — NOT REAL FOOTAGE
      </text>
    </svg>
  );
}
