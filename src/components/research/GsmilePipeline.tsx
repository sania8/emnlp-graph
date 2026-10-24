"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MODEL_ORDER,
  type ModelKey,
  models,
  sentences,
} from "@/lib/nldb";
import { TokenFlowNetwork } from "./TokenFlowNetwork";

type Phase = "tokenise" | "forward" | "perturb" | "attribute" | "ablate";

type Stage = {
  id: Phase;
  label: string;
  title: string;
  body: string;
  hold: number;
};

const STAGES: Stage[] = [
  {
    id: "tokenise",
    label: "Prompt",
    title: "A financial sentence becomes a prompt",
    body: "The models are generative and have no classification head, so the sentence is wrapped in an instruction-style prompt. The model is asked to generate the next token, and only the logits for the three label tokens are read off.",
    hold: 4200,
  },
  {
    id: "forward",
    label: "Forward pass",
    title: "Signal propagates to the label logits",
    body: "Final-token logits over the label vocabulary are passed through a softmax, and the highest-probability label becomes the prediction. That single number is all a conventional pipeline would ever surface.",
    hold: 5200,
  },
  {
    id: "perturb",
    label: "Perturb",
    title: "Thirty perturbed variants of the sentence",
    body: "GSMILE builds 30 perturbed copies, dropping each word with probability between 0.5 and 1.0. If a variant empties out, one random word is put back. Each variant is re-queried, so the model's own behaviour supplies the signal.",
    hold: 5600,
  },
  {
    id: "attribute",
    label: "Surrogate",
    title: "A surrogate model fits the local decision surface",
    body: "The variants are TF-IDF encoded and an XGBoost surrogate is trained against the model's responses, weighted so variants closer to the original sentence count for more. Its feature importances become the token attribution scores.",
    hold: 6000,
  },
  {
    id: "ablate",
    label: "Ablate",
    title: "Remove the top token and re-query",
    body: "The highest-scoring token is deleted and the sentence re-submitted. Whether the label moves is the real test — it separates a word the model merely noticed from one the decision actually depended on.",
    hold: 6400,
  },
];

export function GsmilePipeline() {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [modelKey, setModelKey] = useState<ModelKey>("mistral");
  const [sentenceIdx, setSentenceIdx] = useState(0);
  /** Which perturbation variant is currently on screen. */
  const [variant, setVariant] = useState(0);

  const current = STAGES[stage];
  const sentence = sentences[sentenceIdx];
  const result = sentence.perModel[modelKey];
  const model = models[modelKey];

  const goToStage = useCallback((target: number) => {
    setStage(target);
    setVariant(0);
  }, []);

  const next = useCallback(
    () => goToStage((stage + 1) % STAGES.length),
    [goToStage, stage],
  );

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(next, current.hold);
    return () => clearTimeout(t);
  }, [playing, stage, current.hold, next]);

  // Cycle through perturbation variants while that stage is showing.
  useEffect(() => {
    if (current.id !== "perturb" || reduced) return;
    const i = setInterval(() => setVariant((v) => (v + 1) % 30), 620);
    return () => clearInterval(i);
  }, [current.id, reduced]);

  /**
   * Deterministic word-dropout masks standing in for the 30 variants, built
   * with the paper's own rule: each word dropped with probability in
   * [0.5, 1.0], and at least one word retained.
   */
  const variantMasks = useMemo(() => {
    const toks = sentence.tokens;
    return Array.from({ length: 30 }, (_, v) => {
      const dropped = toks.filter((_, i) => {
        const r = Math.abs(Math.sin((v + 1) * 97.13 + i * 41.7)) % 1;
        return r < 0.5 + ((v % 5) * 0.1);
      });
      return dropped.length === toks.length ? dropped.slice(1) : dropped;
    });
  }, [sentence.tokens]);

  const dropped = current.id === "perturb" ? variantMasks[variant] : undefined;

  const displayPrediction =
    current.id === "ablate" ? result.afterPrediction : result.prediction;

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface">
      {/* ---------------- Controls ---------------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-edge p-3">
        <ol className="flex flex-1 flex-wrap gap-1.5" aria-label="GSMILE stages">
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

      {/* Model + sentence pickers */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-surface-raised px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[0.96rem] uppercase tracking-wider text-muted">
            Model
          </span>
          <div className="inline-flex rounded-md border border-edge p-0.5">
            {MODEL_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setModelKey(k)}
                aria-pressed={modelKey === k}
                className={`rounded px-2.5 py-1 font-mono text-[0.96rem] transition-colors ${
                  modelKey === k
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {models[k].name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[0.96rem] uppercase tracking-wider text-muted">
            Sentence
          </span>
          <div className="inline-flex rounded-md border border-edge p-0.5">
            {sentences.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSentenceIdx(i)}
                aria-pressed={sentenceIdx === i}
                className={`rounded px-2.5 py-1 font-mono text-[0.96rem] transition-colors ${
                  sentenceIdx === i
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {s.id}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* ---------------- Canvas ---------------- */}
        <div>
          {/* The sentence itself */}
          <div className="rounded-lg border border-edge bg-surface-raised p-3">
            <p className="font-mono text-[0.96rem] uppercase tracking-wider text-muted">
              {sentence.id} · ground truth {sentence.truth.toLowerCase()}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-1.5 gap-y-1">
              {sentence.tokens.map((t, i) => {
                const isDropped = dropped?.includes(t);
                const isAblated =
                  current.id === "ablate" && t === result.ablatedToken;
                return (
                  <motion.span
                    key={`${t}-${i}`}
                    className={`rounded px-1 text-sm ${
                      isAblated
                        ? "bg-danger/15 text-danger line-through"
                        : isDropped
                          ? "text-muted/30 line-through"
                          : "text-foreground"
                    }`}
                    initial={false}
                    animate={{ opacity: isDropped || isAblated ? 0.45 : 1 }}
                    transition={{ duration: reduced ? 0 : 0.25 }}
                  >
                    {t}
                  </motion.span>
                );
              })}
            </p>
          </div>

          {/* Network */}
          <div className="relative mt-3 overflow-hidden rounded-lg border border-edge bg-surface">
            <div className="absolute inset-0 bg-grid opacity-20" />
            <div className="relative aspect-[19/9] w-full">
              <TokenFlowNetwork
                attributions={result.attributions}
                prediction={displayPrediction}
                phase={current.id}
                ablatedToken={
                  current.id === "ablate" ? result.ablatedToken : undefined
                }
                droppedTokens={dropped}
                reduced={reduced}
              />
            </div>

            {/* Perturbation counter */}
            <AnimatePresence>
              {current.id === "perturb" ? (
                <motion.div
                  key="counter"
                  className="pointer-events-none absolute right-3 top-3 rounded-md border border-accent/40 bg-surface px-3 py-1.5 backdrop-blur"
                  initial={reduced ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="font-mono text-[0.96rem] uppercase tracking-wider text-accent">
                    variant {String(variant + 1).padStart(2, "0")} / 30
                  </span>
                </motion.div>
              ) : null}
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

          {/* Live result panel */}
          <div className="mt-6 rounded-lg border border-edge bg-surface-raised p-4">
            <p className="font-mono text-[1.02rem] uppercase tracking-wider text-muted">
              {model.name}
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div>
                <p className="font-mono text-[0.96rem] uppercase tracking-wider text-muted">
                  Prediction
                </p>
                <p
                  className={`mt-0.5 text-lg font-semibold ${
                    displayPrediction === "Positive"
                      ? "text-accent"
                      : displayPrediction === "Negative"
                        ? "text-danger"
                        : "text-foreground"
                  }`}
                >
                  {displayPrediction}
                </p>
              </div>
              {(current.id === "ablate"
                ? result.afterConfidence
                : result.confidence) ? (
                <div className="border-l border-edge pl-3">
                  <p className="font-mono text-[0.96rem] uppercase tracking-wider text-muted">
                    Confidence
                  </p>
                  <p className="mt-0.5 font-mono text-lg text-foreground">
                    {current.id === "ablate"
                      ? result.afterConfidence
                      : result.confidence}
                  </p>
                </div>
              ) : null}
            </div>

            <AnimatePresence mode="wait">
              {current.id === "ablate" ? (
                <motion.div
                  key="ablate-detail"
                  className="mt-4 border-t border-edge pt-3"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <p className="flex flex-wrap items-center gap-2 font-mono text-[0.96rem]">
                    <span className="text-muted">removed</span>
                    <span className="rounded bg-danger/15 px-1.5 py-0.5 text-danger">
                      {result.ablatedToken}
                    </span>
                    <span className="text-muted">
                      ({result.ablatedScore.toFixed(3)})
                    </span>
                    <span aria-hidden className="text-accent">
                      →
                    </span>
                    <span
                      className={
                        result.shifted ? "text-accent" : "text-muted"
                      }
                    >
                      {result.shifted ? "LABEL SHIFTED" : "NO SHIFT"}
                    </span>
                  </p>
                  <p className="mt-2.5 text-xs leading-relaxed text-muted">
                    {result.reading}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

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
        Predictions, confidences, attribution scores and ablation outcomes are
        the published results for these two sentences. The network is a
        schematic — the paper does not publish layer dimensions — and the
        perturbation masks are redrawn here using the paper&rsquo;s stated rule
        rather than being the original 30 variants. No model runs in your
        browser.
      </p>
    </div>
  );
}
