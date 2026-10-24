"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { DetectionScene, type SceneFlags } from "./DetectionScene";

type Stage = {
  id: string;
  label: string;
  title: string;
  body: string;
  /** Short technical annotation shown as a chip. */
  chip?: string;
  hold: number;
  flags: SceneFlags;
};

const OFF: SceneFlags = {
  baselineBoxes: false,
  falsePositives: false,
  refinedBoxes: false,
  landmarks: false,
  spatial: false,
  decided: false,
};

const STAGES: Stage[] = [
  {
    id: "frames",
    label: "Frames",
    title: "Input video frames",
    body: "The system consumes a surveillance stream frame by frame. Each frame is an independent detection problem; nothing about phone usage is known yet.",
    chip: "Stream → frames",
    hold: 3000,
    flags: { ...OFF },
  },
  {
    id: "baseline",
    label: "YOLOv8 baseline",
    title: "Pre-trained YOLOv8, straight out of the box",
    body: "A pre-trained YOLOv8 model can already propose person and phone boxes, but on this footage it is unreliable: boxes are loose and it fires on background objects, producing a high false alert rate.",
    chip: "Reported ~75% accuracy · high false alerts",
    hold: 4200,
    flags: { ...OFF, baselineBoxes: true, falsePositives: true },
  },
  {
    id: "finetune",
    label: "Fine-tuned YOLOv7",
    title: "Fine-tuned YOLOv7 replaces the baseline",
    body: "A YOLOv7 detector fine-tuned on this problem tightens the boxes and stops reacting to the background clutter that triggered the baseline. Detection quality improves, but a box around a phone still does not prove someone is using it.",
    chip: "Fine-tuned detector",
    hold: 4200,
    flags: { ...OFF, refinedBoxes: true },
  },
  {
    id: "mediapipe",
    label: "MediaPipe",
    title: "MediaPipe hand tracking added",
    body: "MediaPipe contributes hand landmarks — an articulated skeleton of the hand rather than a rectangle. This gives the system a second, independent signal about where the hand actually is.",
    chip: "Hand landmarks",
    hold: 4200,
    flags: { ...OFF, refinedBoxes: true, landmarks: true },
  },
  {
    id: "spatial",
    label: "Spatial analysis",
    title: "Hand–phone spatial analysis",
    body: "The two signals are combined geometrically: how the hand landmarks sit relative to the phone box. A phone on a counter and a phone held in a hand look very different under this test, even when the detector output is identical.",
    chip: "Hand ∩ phone geometry",
    hold: 4600,
    flags: { ...OFF, refinedBoxes: true, landmarks: true, spatial: true },
  },
  {
    id: "decision",
    label: "Decision logic",
    title: "Decision logic at a 0.60 threshold",
    body: "The spatial relationship is reduced to a single score and compared against a threshold of 0.60. Below it, the frame is ignored; above it, the frame counts as phone usage. The threshold is what converts a continuous measurement into an alert.",
    chip: "Threshold = 0.60",
    hold: 4600,
    flags: { ...OFF, refinedBoxes: true, landmarks: true, spatial: true },
  },
  {
    id: "output",
    label: "Output",
    title: "Phone usage detected",
    body: "Only frames that clear the threshold raise an alert. Combining the fine-tuned detector with hand tracking and the spatial test is what lifted the reported accuracy from roughly 75% to roughly 90%, with far fewer false alerts.",
    chip: "Reported ~90% accuracy",
    hold: 5000,
    flags: {
      ...OFF,
      refinedBoxes: true,
      landmarks: true,
      spatial: true,
      decided: true,
    },
  },
];

export function DetectionSim() {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);

  const current = STAGES[stage];
  const next = useCallback(() => setStage((s) => (s + 1) % STAGES.length), []);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(next, current.hold);
    return () => clearTimeout(t);
  }, [playing, stage, current.hold, next]);

  const showScore = stage >= STAGES.findIndex((s) => s.id === "decision");
  const decided = current.id === "output";

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
                  setStage(i);
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
        {/* ---------------- Canvas ----------------
            min-w-0 is required: the horizontally scrollable stage rail below
            would otherwise widen this grid track to its full content width,
            dragging the canvas out of the card on narrow screens. */}
        <div className="min-w-0">
          <div className="relative aspect-[5/3] w-full overflow-hidden rounded-lg border border-edge bg-surface">
            <DetectionScene flags={current.flags} reduced={reduced} />

            {/* Frame intake animation */}
            <AnimatePresence>
              {current.id === "frames" && !reduced ? (
                <motion.div
                  key="intake"
                  className="pointer-events-none absolute inset-y-0 right-0 flex w-1/3 items-center justify-end gap-2 pr-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-14 w-10 rounded-sm border border-accent/40 bg-accent/5"
                      animate={{ x: [40, -8], opacity: [0, 1, 0] }}
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                        delay: i * 0.6,
                        ease: "linear",
                      }}
                    />
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Stage caption */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-3">
              <AnimatePresence mode="wait">
                <motion.p
                  key={current.id}
                  className="font-mono text-[1.02rem] uppercase tracking-wider text-accent"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {current.chip}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Pipeline rail */}
          <ol className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
            {STAGES.map((s, i) => (
              <li key={s.id} className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`rounded px-2 py-1 font-mono text-[0.96rem] uppercase tracking-wider transition-colors ${
                    i <= stage
                      ? "bg-accent/10 text-accent"
                      : "bg-surface-raised text-muted"
                  }`}
                >
                  {s.label}
                </span>
                {i < STAGES.length - 1 ? (
                  <span
                    aria-hidden
                    className={`text-xs ${i < stage ? "text-accent" : "text-muted"}`}
                  >
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
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

          {/* Threshold gauge */}
          <AnimatePresence>
            {showScore ? (
              <motion.div
                key="gauge"
                className="mt-6 rounded-lg border border-edge bg-surface-raised p-4"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p className="font-mono text-[1.02rem] uppercase tracking-wider text-muted">
                  Decision rule
                </p>
                <div className="relative mt-3 h-2 w-full rounded-full bg-background">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-accent"
                    initial={false}
                    animate={{ width: decided ? "78%" : "34%" }}
                    transition={{ duration: reduced ? 0 : 0.9, ease: "easeOut" }}
                  />
                  <span
                    aria-hidden
                    className="absolute -top-1 bottom-[-0.25rem] left-[60%] w-px bg-foreground/70"
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[0.96rem] uppercase tracking-wider text-muted">
                  <span>0.00</span>
                  <span className="text-foreground">0.60 threshold</span>
                  <span>1.00</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  {decided
                    ? "Score clears the threshold — the frame is reported as phone usage."
                    : "Below the threshold the frame is discarded, no matter how confident the detector was."}
                </p>
                <p className="mt-2 text-[1.02rem] leading-relaxed text-muted/80">
                  The bar position is schematic. Only the 0.60 threshold is an
                  actual configured value.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-auto flex gap-2 pt-6">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setStage(0);
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
        The frame above is an original schematic drawing, not real footage, and
        no model runs on this page. It exists to show what each stage
        contributes. Genuine detector output is shown further down as recorded
        video. Accuracy figures are as reported for this project.
      </p>
    </div>
  );
}
