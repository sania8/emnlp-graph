"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { Sentiment, TokenAttribution } from "@/lib/nldb";
import { palette } from "@/lib/palette";

const ACCENT = palette.accent;
const WARN = palette.warn;
const NEG = palette.danger;
const DIM = palette.dim;
const SOFT = palette.soft;

const W = 760;
const H = 360;

/** Hidden-layer widths for the schematic dense stack. */
const LAYERS = [9, 11, 9];
const LAYER_X = [286, 396, 506];
const TOKEN_X = 96;
const OUT_X = 652;

const OUTPUTS: { label: Sentiment; colour: string }[] = [
  { label: "Positive", colour: ACCENT },
  { label: "Neutral", colour: SOFT },
  { label: "Negative", colour: NEG },
];

type Phase =
  | "idle"
  | "tokenise"
  | "forward"
  | "perturb"
  | "attribute"
  | "ablate";

function spread(count: number, top: number, bottom: number) {
  if (count === 1) return [(top + bottom) / 2];
  const step = (bottom - top) / (count - 1);
  return Array.from({ length: count }, (_, i) => top + i * step);
}

/**
 * Schematic of a token sequence flowing through dense layers to sentiment
 * logits.
 *
 * The layer widths are illustrative — the paper does not publish an internal
 * architecture, so no real dimensions are implied. What *is* faithful is the
 * data this is driven by: token importance comes from the published GSMILE
 * attribution scores, and the highlighted output is the published prediction.
 */
export function TokenFlowNetwork({
  attributions,
  prediction,
  phase,
  ablatedToken,
  droppedTokens,
  reduced,
}: {
  attributions: TokenAttribution[];
  prediction: Sentiment;
  phase: Phase;
  /** Token removed during the ablation phase. */
  ablatedToken?: string;
  /** Tokens masked out during the perturbation phase. */
  droppedTokens?: string[];
  reduced: boolean | null;
}) {
  const tokenYs = useMemo(
    () => spread(attributions.length, 36, H - 36),
    [attributions.length],
  );

  const layerYs = useMemo(
    () => LAYERS.map((n) => spread(n, 44, H - 44)),
    [],
  );

  const outYs = useMemo(() => spread(OUTPUTS.length, 118, H - 118), []);

  const maxScore = Math.max(
    ...attributions.map((a) => a.score ?? 0),
    0.0001,
  );

  const showNet = phase !== "tokenise" && phase !== "idle";
  const showScores = phase === "attribute" || phase === "ablate";
  const flowing = (phase === "forward" || phase === "ablate") && !reduced;

  /** A deterministic subset of edges carries animated signal particles. */
  const particleEdges = useMemo(() => {
    const picks: { x1: number; y1: number; x2: number; y2: number; d: number }[] =
      [];
    for (let l = 0; l < LAYERS.length - 1; l++) {
      for (let i = 0; i < LAYERS[l]; i += 2) {
        const j = (i * 3 + l * 2) % LAYERS[l + 1];
        picks.push({
          x1: LAYER_X[l],
          y1: layerYs[l][i],
          x2: LAYER_X[l + 1],
          y2: layerYs[l + 1][j],
          d: (l * 0.25 + i * 0.09) % 1.2,
        });
      }
    }
    return picks;
  }, [layerYs]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      role="img"
      aria-label={`Diagram of tokens flowing through dense network layers to a ${prediction} sentiment output, with token importance from GSMILE attribution`}
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill={ACCENT} />
        </marker>
        <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ---------- Column captions ---------- */}
      <text x={TOKEN_X} y="16" fill={SOFT} fontSize="13.3" fontFamily="monospace" textAnchor="middle">
        tokens
      </text>
      <text x={LAYER_X[1]} y="16" fill={SOFT} fontSize="13.3" fontFamily="monospace" textAnchor="middle">
        dense layers (schematic)
      </text>
      <text x={OUT_X} y="16" fill={SOFT} fontSize="13.3" fontFamily="monospace" textAnchor="middle">
        label logits → softmax
      </text>

      {/* ---------- Token → first layer edges ---------- */}
      {showNet &&
        attributions.map((a, i) => {
          const weight = (a.score ?? 0) / maxScore;
          const dropped = droppedTokens?.includes(a.token);
          const ablated = ablatedToken === a.token && phase === "ablate";
          const live = !dropped && !ablated;
          return layerYs[0].map((y, j) =>
            j % 2 === 0 || weight > 0.3 ? (
              <line
                key={`t${i}-${j}`}
                x1={TOKEN_X + 44}
                y1={tokenYs[i]}
                x2={LAYER_X[0]}
                y2={y}
                stroke={weight > 0.3 ? ACCENT : palette.mesh}
                strokeWidth={live ? 0.5 + weight * 1.5 : 0.4}
                strokeOpacity={live ? 0.35 + weight * 0.6 : 0.15}
              />
            ) : null,
          );
        })}

      {/* ---------- Dense inter-layer edges ---------- */}
      {showNet &&
        layerYs.slice(0, -1).map((col, l) =>
          col.map((y1, i) =>
            layerYs[l + 1].map((y2, j) =>
              (i + j) % 2 === 0 ? (
                <line
                  key={`l${l}-${i}-${j}`}
                  x1={LAYER_X[l]}
                  y1={y1}
                  x2={LAYER_X[l + 1]}
                  y2={y2}
                  stroke={palette.mesh}
                  strokeWidth="0.5"
                  strokeOpacity="0.9"
                />
              ) : null,
            ),
          ),
        )}

      {/* ---------- Last layer → outputs ---------- */}
      {showNet &&
        layerYs[LAYERS.length - 1].map((y, i) =>
          outYs.map((oy, j) => {
            const isWinner = OUTPUTS[j].label === prediction;
            return (
              <line
                key={`o${i}-${j}`}
                x1={LAYER_X[LAYER_X.length - 1]}
                y1={y}
                x2={OUT_X - 42}
                y2={oy}
                stroke={isWinner ? OUTPUTS[j].colour : palette.mesh}
                strokeWidth={isWinner ? 1.1 : 0.5}
                strokeOpacity={isWinner ? 0.75 : 0.9}
              />
            );
          }),
        )}

      {/* ---------- Signal particles ---------- */}
      {flowing &&
        particleEdges.map((e, i) => (
          <motion.circle
            key={`p${i}`}
            r="2"
            fill={ACCENT}
            filter="url(#glow)"
            animate={{
              cx: [e.x1, e.x2],
              cy: [e.y1, e.y2],
              opacity: [0, 0.95, 0],
            }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: e.d,
              ease: "linear",
            }}
          />
        ))}

      {/* Token → network streamers */}
      {flowing &&
        attributions.map((a, i) => {
          const weight = (a.score ?? 0) / maxScore;
          if (weight < 0.25) return null;
          if (ablatedToken === a.token && phase === "ablate") return null;
          return (
            <motion.circle
              key={`ts${i}`}
              r="2.6"
              fill={ACCENT}
              filter="url(#glow)"
              animate={{
                cx: [TOKEN_X + 44, LAYER_X[0]],
                cy: [tokenYs[i], layerYs[0][i % LAYERS[0]]],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.12,
                ease: "linear",
              }}
            />
          );
        })}

      {/* ---------- Hidden units ---------- */}
      {showNet &&
        layerYs.map((col, l) =>
          col.map((y, i) => (
            <motion.circle
              key={`n${l}-${i}`}
              cx={LAYER_X[l]}
              cy={y}
              r="4.5"
              fill={palette.panel}
              stroke={ACCENT}
              strokeWidth="1"
              initial={false}
              animate={{
                strokeOpacity: flowing ? [0.3, 0.95, 0.3] : 0.45,
              }}
              transition={{
                duration: 1.8,
                repeat: flowing ? Infinity : 0,
                delay: (l * 0.2 + i * 0.07) % 1.6,
                ease: "easeInOut",
              }}
            />
          )),
        )}

      {/* ---------- Token nodes ---------- */}
      {attributions.map((a, i) => {
        const weight = (a.score ?? 0) / maxScore;
        const dropped = droppedTokens?.includes(a.token);
        const ablated = ablatedToken === a.token && phase === "ablate";
        const w = Math.max(a.token.length * 9.5 + 24, 64);

        return (
          <motion.g
            key={a.token + i}
            initial={false}
            animate={{
              opacity: ablated ? 0.18 : dropped ? 0.22 : 1,
              x: ablated ? -16 : 0,
            }}
            transition={{ duration: reduced ? 0 : 0.5 }}
          >
            <rect
              x={TOKEN_X + 44 - w}
              y={tokenYs[i] - 10}
              width={w}
              height={20}
              rx="5"
              fill={palette.panel}
              stroke={
                ablated ? NEG : a.score != null ? ACCENT : DIM
              }
              strokeWidth={a.score != null ? 1.3 : 0.9}
            />
            <text
              x={TOKEN_X + 44 - w / 2}
              y={tokenYs[i] + 3.5}
              fill={a.score != null ? palette.text : SOFT}
              fontSize="13.3"
              fontFamily="monospace"
              textAnchor="middle"
              textDecoration={ablated ? "line-through" : undefined}
            >
              {a.token}
            </text>

            {/* Importance bar + score */}
            {showScores && a.score != null ? (
              <g>
                <motion.rect
                  x={TOKEN_X + 50}
                  y={tokenYs[i] - 3.5}
                  height="7"
                  rx="1.5"
                  fill={weight > 0.6 ? ACCENT : WARN}
                  initial={false}
                  animate={{ width: ablated ? 0 : weight * 56 }}
                  transition={{ duration: reduced ? 0 : 0.7, ease: "easeOut" }}
                />
                <text
                  x={TOKEN_X + 50 + weight * 56 + 5}
                  y={tokenYs[i] + 3}
                  fill={SOFT}
                  fontSize="11.8"
                  fontFamily="monospace"
                >
                  {a.score.toFixed(3)}
                </text>
              </g>
            ) : null}
          </motion.g>
        );
      })}

      {/* ---------- Output nodes ---------- */}
      {showNet &&
        OUTPUTS.map((o, j) => {
          const isWinner = o.label === prediction;
          return (
            <motion.g
              key={o.label}
              initial={false}
              animate={{ opacity: isWinner ? 1 : 0.65 }}
              transition={{ duration: reduced ? 0 : 0.5 }}
            >
              <rect
                x={OUT_X - 42}
                y={outYs[j] - 14}
                width="92"
                height="28"
                rx="6"
                fill={palette.panel}
                stroke={o.colour}
                strokeWidth={isWinner ? 1.8 : 1.1}
                filter={isWinner && !reduced ? "url(#glow)" : undefined}
              />
              <text
                x={OUT_X + 4}
                y={outYs[j] + 4}
                fill={o.colour}
                fontSize="14.8"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {o.label}
              </text>
              {isWinner ? (
                <motion.path
                  d={`M${OUT_X + 52} ${outYs[j]} L${OUT_X + 74} ${outYs[j]}`}
                  stroke={o.colour}
                  strokeWidth="1.6"
                  markerEnd="url(#arrow)"
                  initial={false}
                  animate={{ opacity: reduced ? 1 : [0.35, 1, 0.35] }}
                  transition={{ duration: 1.8, repeat: reduced ? 0 : Infinity }}
                />
              ) : null}
            </motion.g>
          );
        })}
    </svg>
  );
}
