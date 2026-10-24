"use client";

import { motion } from "framer-motion";
import { palette } from "@/lib/palette";

const ACCENT = palette.accent;
const WARN = palette.warn;
const DIM = palette.dim;
const SOFT = palette.soft;

/**
 * Qualitative illustration of the reduced-order two-degree-of-freedom
 * conductor–damper model described in the paper.
 *
 * The paper states that a healthy damper acts as a tuned mass damper on the
 * first local conductor mode, and that corrosion is encoded as loss of damper
 * damping plus detuning of damper stiffness, reducing energy dissipation. The
 * two traces below express exactly that qualitative contrast — they are drawn
 * shapes, not plotted Simulink output.
 */

/** A damped sinusoid: healthy decays quickly, corroded sustains. */
function trace(decay: number, amplitude: number, width = 300, height = 54) {
  const pts: string[] = [];
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * width;
    const envelope = Math.exp(-decay * t);
    const y =
      height / 2 -
      Math.sin(t * Math.PI * 9) * (height / 2 - 4) * envelope * amplitude;
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

export function DamperPhysics({
  active,
  reduced,
}: {
  active: boolean;
  reduced: boolean | null;
}) {
  const healthy = trace(3.4, 1);
  const corroded = trace(0.45, 1);

  return (
    <svg
      viewBox="0 0 360 230"
      className="h-full w-full"
      role="img"
      aria-label="Comparison of conductor vibration decay for a healthy versus corroded Stockbridge damper, with the physics features logged by each simulation run"
    >
      {/* ---- Schematic of the 2-DOF system ---- */}
      <g>
        <text x="8" y="14" fill={SOFT} fontSize="11.8" fontFamily="monospace">
          2-DOF conductor–damper model
        </text>
        {/* conductor */}
        <line x1="8" y1="40" x2="352" y2="40" stroke={SOFT} strokeWidth="1.6" />
        <text x="8" y="34" fill={SOFT} fontSize="10.4" fontFamily="monospace">
          conductor · x
        </text>
        {/* clamp */}
        <rect x="170" y="36" width="12" height="9" rx="1.5" fill={SOFT} />
        {/* messenger wire + counterweights */}
        <motion.g
          animate={
            active && !reduced ? { rotate: [-3, 3, -3] } : { rotate: 0 }
          }
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "176px 45px" }}
        >
          <path
            d="M176 45 L176 58 M148 58 L204 58"
            stroke={SOFT}
            strokeWidth="1.4"
            fill="none"
          />
          <ellipse cx="144" cy="58" rx="9" ry="6" fill={palette.raised} stroke={ACCENT} strokeWidth="1.2" />
          <ellipse cx="208" cy="58" rx="9" ry="6" fill={palette.raised} stroke={ACCENT} strokeWidth="1.2" />
        </motion.g>
        <text x="228" y="62" fill={SOFT} fontSize="10.4" fontFamily="monospace">
          damper · y
        </text>
        {/* wind forcing */}
        <motion.g
          animate={active && !reduced ? { x: [0, 8, 0] } : { x: 0 }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M14 54 L40 54 M34 50 L40 54 L34 58"
            stroke={ACCENT}
            strokeWidth="1.2"
            fill="none"
          />
          <text x="14" y="70" fill={ACCENT} fontSize="10.4" fontFamily="monospace">
            F(t) = F₀ sin(2πft)
          </text>
        </motion.g>
      </g>

      {/* ---- Healthy trace ---- */}
      <g transform="translate(30, 92)">
        <text x="-22" y="-6" fill={ACCENT} fontSize="11.1" fontFamily="monospace">
          good condition — energy dissipated
        </text>
        <line x1="0" y1="27" x2="300" y2="27" stroke={DIM} strokeWidth="1" />
        <motion.path
          d={healthy}
          fill="none"
          stroke={ACCENT}
          strokeWidth="1.5"
          initial={false}
          animate={{ pathLength: active ? 1 : 0.15, opacity: active ? 1 : 0.4 }}
          transition={{ duration: reduced ? 0 : 1.2, ease: "easeOut" }}
        />
      </g>

      {/* ---- Corroded trace ---- */}
      <g transform="translate(30, 168)">
        <text x="-22" y="-6" fill={WARN} fontSize="11.1" fontFamily="monospace">
          corroded — damping lost, damper detuned
        </text>
        <line x1="0" y1="27" x2="300" y2="27" stroke={DIM} strokeWidth="1" />
        <motion.path
          d={corroded}
          fill="none"
          stroke={WARN}
          strokeWidth="1.5"
          initial={false}
          animate={{ pathLength: active ? 1 : 0.15, opacity: active ? 1 : 0.4 }}
          transition={{
            duration: reduced ? 0 : 1.2,
            delay: reduced ? 0 : 0.25,
            ease: "easeOut",
          }}
        />
      </g>
    </svg>
  );
}

/** Reasoner-facing features logged per run, as listed in the paper. */
export const PHYSICS_FEATURES = [
  "conductor RMS displacement",
  "peak displacement",
  "relative RMS displacement",
  "fatigue damage index",
  "damping health index",
  "risk score",
];
