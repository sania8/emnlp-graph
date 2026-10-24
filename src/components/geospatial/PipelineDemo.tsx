"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeatureClass } from "@/lib/geospatial";

/** Outer tile grid (TILES × TILES) and the patch split inside each tile. */
const TILES = 4;
const SUB = 2;
/** Patches per axis once tiles are subdivided. Also the number of layers. */
const N = TILES * SUB;
/** Each patch occupies this share of the canvas, in %. */
const CELL = 100 / N;
/** Milliseconds each layer spends under the model during the sweep. */
const LAYER_MS = 420;

type StageId =
  | "raster"
  | "tiling"
  | "patches"
  | "dispersal"
  | "inference"
  | "stitching"
  | "output";

type Stage = {
  id: StageId;
  label: string;
  title: string;
  body: string;
  /** Dwell time in ms when auto-playing. */
  hold: number;
  /** Separation between tiles, in % of the canvas. */
  tileSpread: number;
  /** Separation between patches within a tile, in % of the canvas. */
  patchSpread: number;
  /** Strength of the free-floating scatter. */
  scatter: number;
  /** Canvas-wide zoom, used to keep the dispersed field in frame. */
  zoom: number;
};

const STAGES: Stage[] = [
  {
    id: "raster",
    label: "Input raster",
    title: "One very large GeoTIFF",
    body: "The pipeline starts from a high-resolution drone raster. At full extent it is far larger than anything a segmentation network can accept in a single forward pass, so it cannot be handed to the model as-is.",
    hold: 2600,
    tileSpread: 0,
    patchSpread: 0,
    scatter: 0,
    zoom: 1,
  },
  {
    id: "tiling",
    label: "Tiling",
    title: "Break the scene into tiles",
    body: "The raster is cut along a regular grid. Each tile is an independent sample that remembers where it came from, so it can be processed on its own and found again later.",
    hold: 2800,
    tileSpread: 1.6,
    patchSpread: 0,
    scatter: 0,
    zoom: 0.96,
  },
  {
    id: "patches",
    label: "Patching",
    title: "Subdivide to model input size",
    body: "Tiles are split further until each patch matches the fixed input size the network expects. This is the unit that actually enters the model — everything above it is bookkeeping.",
    hold: 2800,
    tileSpread: 2.2,
    patchSpread: 0.9,
    scatter: 0,
    zoom: 0.92,
  },
  {
    id: "dispersal",
    label: "Dispatch",
    title: "Patches leave the grid",
    body: "With their positions recorded, the patches no longer need to sit next to each other. They are queued as an unordered batch — the scene has stopped being a picture and has become a pile of independent inputs.",
    hold: 3600,
    tileSpread: 4.2,
    patchSpread: 2.4,
    scatter: 1,
    zoom: 0.74,
  },
  {
    id: "inference",
    label: "Inference",
    title: "The model sweeps layer by layer",
    body: "The batch is worked through one layer at a time. As each layer passes under the network, its patches come back carrying a segmentation mask instead of raw imagery.",
    hold: N * LAYER_MS + 1400,
    tileSpread: 4.2,
    patchSpread: 2.4,
    scatter: 1,
    zoom: 0.74,
  },
  {
    id: "stitching",
    label: "Stitching",
    title: "Everything converges back",
    body: "Each mask is written back into the exact position its patch came from. The field collapses, the seams close, and the patches merge back into tiles and then into a single surface.",
    hold: 3200,
    tileSpread: 0,
    patchSpread: 0,
    scatter: 0,
    zoom: 1,
  },
  {
    id: "output",
    label: "Output map",
    title: "A single continuous map",
    body: "What is on screen now was assembled entirely from the patches you just watched travel out and come back — one classified surface aligned to the source raster.",
    hold: 4200,
    tileSpread: 0,
    patchSpread: 0,
    scatter: 0,
    zoom: 1,
  },
];

/** Background offset so each patch shows its own slice of the scene. */
function patchStyle(row: number, col: number, src: string) {
  return {
    backgroundImage: `url(${src})`,
    backgroundSize: `${N * 100}% ${N * 100}%`,
    backgroundPosition: `${(col / (N - 1)) * 100}% ${(row / (N - 1)) * 100}%`,
  } as const;
}

/**
 * Same slice, but as a CSS mask so a flat class colour can be painted through
 * the genuine mask geometry on the final map.
 */
function maskStyle(row: number, col: number, mask: string, colour: string) {
  const size = `${N * 100}% ${N * 100}%`;
  const position = `${(col / (N - 1)) * 100}% ${(row / (N - 1)) * 100}%`;
  return {
    backgroundColor: colour,
    maskImage: `url(${mask})`,
    maskSize: size,
    maskPosition: position,
    maskRepeat: "no-repeat",
    WebkitMaskImage: `url(${mask})`,
    WebkitMaskSize: size,
    WebkitMaskPosition: position,
    WebkitMaskRepeat: "no-repeat",
  } as const;
}

export function PipelineDemo({
  classes,
  raster,
  prediction,
  predictionMask,
  sceneLabel,
  sceneSource,
  sceneColour,
}: {
  classes: FeatureClass[];
  raster: string;
  prediction: string;
  predictionMask: string;
  sceneLabel: string;
  sceneSource: string;
  sceneColour: string;
}) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [classIndex, setClassIndex] = useState(0);
  /** Index of the layer currently under the model; -1 before the sweep starts. */
  const [activeLayer, setActiveLayer] = useState(-1);

  const current = STAGES[stage];
  const activeClass = classes[classIndex];
  const sample = activeClass?.samples[0];

  /**
   * All stage changes funnel through here so the layer sweep is reset in the
   * same update as the stage itself, rather than reacting to it afterwards.
   */
  const goToStage = useCallback(
    (target: number) => {
      setStage(target);
      const entering = STAGES[target].id === "inference";
      setActiveLayer(entering ? (reduced ? N - 1 : 0) : -1);
    },
    [reduced],
  );

  const next = useCallback(
    () => goToStage((stage + 1) % STAGES.length),
    [goToStage, stage],
  );

  // Stage auto-advance.
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(next, current.hold);
    return () => clearTimeout(t);
  }, [playing, stage, current.hold, next]);

  // Layer-by-layer sweep, only while the inference stage is showing.
  useEffect(() => {
    if (current.id !== "inference" || reduced) return;
    const interval = setInterval(() => {
      setActiveLayer((l) => (l >= N - 1 ? l : l + 1));
    }, LAYER_MS);
    return () => clearInterval(interval);
  }, [current.id, reduced]);

  /**
   * Deterministic per-patch drift so the dispersed field looks like a loose
   * batch rather than a rigid grid, while staying identical between renders.
   */
  const drift = useMemo(
    () =>
      Array.from({ length: N * N }, (_, i) => {
        const a = Math.sin(i * 12.9898) * 43758.5453;
        const b = Math.sin(i * 78.233) * 12345.6789;
        const c = Math.sin(i * 39.425) * 24634.6345;
        return {
          x: ((a - Math.floor(a)) - 0.5) * 2,
          y: ((b - Math.floor(b)) - 0.5) * 2,
          rotate: ((c - Math.floor(c)) - 0.5) * 2,
          float: 0.6 + (a - Math.floor(a)) * 0.8,
          phase: (b - Math.floor(b)) * 2,
        };
      }),
    [],
  );

  const stageIndexById = (id: StageId) => STAGES.findIndex((s) => s.id === id);
  const maskedEverywhere = stage >= stageIndexById("stitching");
  const sweeping = current.id === "inference";
  /** Final stage swaps the muted export palette for a legible map palette. */
  const classified = current.id === "output";

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface">
      {/* Stage selector */}
      <div className="flex flex-wrap items-center gap-2 border-b border-edge p-3">
        <ol className="flex flex-1 flex-wrap gap-1.5" aria-label="Pipeline stages">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  goToStage(i);
                }}
                aria-current={i === stage ? "step" : undefined}
                className={`rounded-md px-2.5 py-1.5 font-mono text-[1.02rem] uppercase tracking-wider transition-colors ${
                  i === stage
                    ? "bg-accent/15 text-accent ring-1 ring-accent/40"
                    : "text-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                <span aria-hidden className="mr-1.5 opacity-50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded-md border border-edge px-3 py-1.5 font-mono text-[1.02rem] uppercase tracking-wider text-muted transition-colors hover:border-accent/40 hover:text-accent"
        >
          {playing ? "❙❙ Pause" : "▶ Play"}
        </button>
      </div>

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        {/* ---------------- Canvas ---------------- */}
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-edge bg-surface">
          <div className="absolute inset-0 bg-grid opacity-30" />

          <motion.div
            className="absolute inset-0"
            animate={{ scale: current.zoom }}
            transition={{ duration: 1.1, ease }}
          >
            {Array.from({ length: N * N }, (_, i) => {
              const row = Math.floor(i / N);
              const col = i % N;
              const tileRow = Math.floor(row / SUB);
              const tileCol = Math.floor(col / SUB);
              const d = drift[i];

              // Offsets expressed in % of the canvas, then converted to a
              // share of the patch's own width for the transform.
              const tileCentre = (TILES - 1) / 2;
              const subCentre = (SUB - 1) / 2;
              const offsetX =
                (tileCol - tileCentre) * current.tileSpread +
                ((col % SUB) - subCentre) * current.patchSpread +
                d.x * current.scatter * 9;
              const offsetY =
                (tileRow - tileCentre) * current.tileSpread +
                ((row % SUB) - subCentre) * current.patchSpread +
                d.y * current.scatter * 9;

              const toSelf = (v: number) => (v / CELL) * 100;
              const baseX = toSelf(offsetX);
              const baseY = toSelf(offsetY);

              const floating = current.scatter > 0 && !reduced;
              const amp = d.float * current.scatter * 2.2;

              const isActiveLayer = sweeping && row === activeLayer;
              const masked =
                maskedEverywhere || (sweeping && activeLayer >= row);

              return (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${col * CELL}%`,
                    top: `${row * CELL}%`,
                    width: `${CELL}%`,
                    height: `${CELL}%`,
                  }}
                  animate={{
                    x: floating ? [baseX - amp, baseX + amp, baseX - amp] : baseX,
                    y: floating ? [baseY + amp, baseY - amp, baseY + amp] : baseY,
                    rotate: reduced ? 0 : d.rotate * current.scatter * 4,
                    scale: isActiveLayer ? 1.06 : 1,
                    zIndex: isActiveLayer ? 2 : 1,
                  }}
                  transition={{
                    x: floating
                      ? {
                          duration: 5 + d.phase,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }
                      : { duration: 1.1, ease },
                    y: floating
                      ? {
                          duration: 6 + d.phase,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }
                      : { duration: 1.1, ease },
                    rotate: { duration: 1.1, ease },
                    scale: { duration: 0.35, ease },
                  }}
                >
                  <div className="absolute inset-0 overflow-hidden">
                    {/* Source imagery */}
                    <div
                      className="absolute inset-0"
                      style={patchStyle(row, col, raster)}
                    />
                    {/* Genuine prediction for the same patch */}
                    <motion.div
                      className="absolute inset-0"
                      style={patchStyle(row, col, prediction)}
                      initial={false}
                      animate={{ opacity: masked && !classified ? 1 : 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                    {/* Final map: darkened basemap … */}
                    <motion.div
                      className="absolute inset-0 bg-background"
                      initial={false}
                      animate={{ opacity: classified ? 0.6 : 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                    {/* … with the same mask geometry painted in a class colour */}
                    <motion.div
                      className="absolute inset-0"
                      style={maskStyle(row, col, predictionMask, sceneColour)}
                      initial={false}
                      animate={{ opacity: classified ? 0.92 : 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                    {/* Patch edge, visible only while the field is open */}
                    <motion.div
                      className="pointer-events-none absolute inset-0 ring-1 ring-inset"
                      initial={false}
                      animate={{
                        opacity:
                          current.patchSpread > 0 || current.tileSpread > 0
                            ? 1
                            : 0,
                      }}
                      style={{
                        boxShadow: isActiveLayer
                          ? "0 0 18px rgba(53,214,198,0.45)"
                          : undefined,
                      }}
                      transition={{ duration: 0.5, ease }}
                    />
                    <motion.div
                      className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-accent"
                      initial={false}
                      animate={{ opacity: isActiveLayer ? 1 : 0 }}
                      transition={{ duration: 0.25 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Model band riding the active layer */}
          <AnimatePresence>
            {sweeping && activeLayer >= 0 ? (
              <motion.div
                key="band"
                className="pointer-events-none absolute inset-x-0 flex justify-center"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  top: `${(activeLayer + 0.5) * CELL * current.zoom + (100 * (1 - current.zoom)) / 2}%`,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease }}
              >
                <span className="-translate-y-1/2 rounded-full border border-accent/50 bg-surface px-3 py-1 font-mono text-[0.96rem] uppercase tracking-wider text-accent backdrop-blur">
                  Layer {activeLayer + 1} / {N} · U-Net · DeepLabV3
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Legend for the classified output map */}
          <AnimatePresence>
            {classified ? (
              <motion.div
                key="legend"
                className="pointer-events-none absolute left-4 top-4 rounded-md border border-edge bg-surface px-3 py-2 backdrop-blur"
                initial={reduced ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p className="font-mono text-[0.98rem] uppercase tracking-[0.2em] text-muted">
                  Legend
                </p>
                <p className="mt-1.5 flex items-center gap-2 font-mono text-[0.96rem] uppercase tracking-wider text-foreground">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: sceneColour }}
                  />
                  {sceneLabel}
                </p>
                <p className="mt-1 flex items-center gap-2 font-mono text-[0.96rem] uppercase tracking-wider text-muted">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-sm border border-edge bg-background"
                  />
                  Unclassified
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Caption */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-4">
            <AnimatePresence mode="wait">
              <motion.p
                key={current.id}
                className="font-mono text-[1.02rem] uppercase tracking-wider text-accent"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {current.id === "raster"
                  ? "Source drone imagery"
                  : current.id === "tiling"
                    ? `${TILES} × ${TILES} tile grid`
                    : current.id === "patches"
                      ? `${N} × ${N} model-input patches`
                      : current.id === "dispersal"
                        ? `${N * N} patches queued as a batch`
                        : current.id === "inference"
                          ? `Masks returning · layer ${Math.max(activeLayer + 1, 1)} of ${N}`
                          : current.id === "stitching"
                            ? "Patches returning to position"
                            : "Assembled segmentation map · classified palette"}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* ---------------- Narration ---------------- */}
        <div className="flex flex-col">
          <div className="flex gap-1" aria-hidden>
            {STAGES.map((s, i) => (
              <span
                key={s.id}
                className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
                  i <= stage ? "bg-accent" : "bg-edge"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              className="mt-5"
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <p className="font-mono text-[1.02rem] uppercase tracking-[0.25em] text-accent">
                Stage {stage + 1} / {STAGES.length}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                {current.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {current.body}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Real exported panels, surfaced during the inference stage */}
          <AnimatePresence>
            {sweeping && sample ? (
              <motion.div
                key="panels"
                className="mt-6 rounded-lg border border-edge bg-surface-raised p-3"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[1.02rem] uppercase tracking-wider text-muted">
                    Exported output · {activeClass.label}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setClassIndex((c) => (c + 1) % Math.max(classes.length, 1))
                    }
                    className="rounded border border-edge px-2 py-1 font-mono text-[0.96rem] uppercase tracking-wider text-muted transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    Next class
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["image", "Patch"],
                      ["ground-truth", "Ground truth"],
                      ["prediction", "Prediction"],
                    ] as const
                  ).map(([key, label]) => (
                    <figure key={key}>
                      <div className="relative aspect-square overflow-hidden rounded border border-edge">
                        <Image
                          src={sample[key]}
                          alt={`${label} panel for a ${activeClass.label.toLowerCase()} patch`}
                          fill
                          sizes="120px"
                          className="object-cover"
                        />
                      </div>
                      <figcaption className="mt-1.5 text-center font-mono text-[0.96rem] uppercase tracking-wider text-muted">
                        {label}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-auto flex gap-2 pt-6">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                goToStage(0);
              }}
              className="rounded-md border border-edge px-4 py-2.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-accent"
            >
              ↺ Restart
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                next();
              }}
              className="flex-1 rounded-md border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              Next stage →
            </button>
          </div>
        </div>
      </div>

      <p className="border-t border-edge px-4 py-3 text-xs leading-relaxed text-muted sm:px-6">
        <span className="font-mono uppercase tracking-wider text-accent/80">
          Illustrative simulation ·
        </span>{" "}
        The imagery is real — a project tile ({sceneSource},{" "}
        {sceneLabel.toLowerCase()}) and the genuine segmentation mask exported
        for it. The dispersal, layer sweep and reassembly are a browser-side
        dramatisation of the tiling and stitching steps, not a recording of the
        actual run. On the final map the mask keeps its original geometry but is
        recoloured for legibility — the colour is a display convention, not a
        value from the model. No model executes on this page and no accuracy
        figures are implied.
      </p>
    </div>
  );
}
