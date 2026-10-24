"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { MODEL_ORDER, models, robustness, sentences } from "@/lib/nldb";

const SENTIMENT_COLOUR: Record<string, string> = {
  Positive: "text-accent",
  Neutral: "text-foreground",
  Negative: "text-danger",
};

/**
 * Three models, the same two sentences, the same ablation test. All values are
 * the published results; where the paper reports no confidence the cell says so.
 */
export function ModelComparison() {
  const reduced = useReducedMotion();
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const sentence = sentences[sentenceIdx];

  return (
    <div>
      {/* Sentence switch */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[1.02rem] uppercase tracking-wider text-muted">
          Sentence
        </span>
        <div className="inline-flex rounded-md border border-edge p-0.5">
          {sentences.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSentenceIdx(i)}
              aria-pressed={sentenceIdx === i}
              className={`rounded px-3 py-1.5 font-mono text-[1.02rem] uppercase tracking-wider transition-colors ${
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

      <p className="mt-4 rounded-lg border border-edge bg-surface-raised p-4 text-sm italic leading-relaxed text-foreground">
        &ldquo;{sentence.text}&rdquo;
        <span className="ml-2 font-mono text-[0.96rem] not-italic uppercase tracking-wider text-muted">
          ground truth: {sentence.truth}
        </span>
      </p>

      {/* Three model columns */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {MODEL_ORDER.map((key, idx) => {
          const m = models[key];
          const r = sentence.perModel[key];

          return (
            <motion.div
              key={key}
              className="flex flex-col rounded-lg border border-edge bg-surface p-5 transition-colors hover:border-accent/30"
              initial={reduced ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-base font-semibold tracking-tight">
                  {m.name}
                </h4>
                <span className="font-mono text-[0.96rem] text-muted">
                  {m.params}
                </span>
              </div>

              {/* Prediction → ablation → outcome */}
              <div className="mt-5 space-y-3">
                <Row
                  label="Prediction"
                  value={
                    <span className={SENTIMENT_COLOUR[r.prediction]}>
                      {r.prediction}
                      {r.confidence ? (
                        <span className="ml-1.5 text-muted">
                          · {r.confidence}
                        </span>
                      ) : null}
                    </span>
                  }
                />
                <Row
                  label="Top token"
                  value={
                    <span className="text-foreground">
                      {r.ablatedToken}
                      <span className="ml-1.5 text-muted">
                        {r.ablatedScore.toFixed(3)}
                      </span>
                    </span>
                  }
                />
                <div className="flex justify-center py-0.5">
                  <motion.span
                    aria-hidden
                    className="font-mono text-sm text-accent"
                    animate={
                      reduced ? undefined : { y: [0, 3, 0], opacity: [0.4, 1, 0.4] }
                    }
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      delay: idx * 0.2,
                    }}
                  >
                    ↓ remove
                  </motion.span>
                </div>
                <Row
                  label="After"
                  value={
                    <span className={SENTIMENT_COLOUR[r.afterPrediction]}>
                      {r.afterPrediction}
                      {r.afterConfidence ? (
                        <span className="ml-1.5 text-muted">
                          · {r.afterConfidence}
                        </span>
                      ) : null}
                    </span>
                  }
                />
              </div>

              <div
                className={`mt-4 rounded-md border px-3 py-2 text-center font-mono text-[0.96rem] uppercase tracking-wider ${
                  r.shifted
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-edge bg-surface-raised text-muted"
                }`}
              >
                {r.shifted ? "Label shifted" : "No shift"}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-muted">
                {r.reading}
              </p>

              <p className="mt-auto border-t border-edge pt-4 text-xs leading-relaxed text-muted">
                <span className="font-mono uppercase tracking-wider text-accent/70">
                  Overall ·
                </span>{" "}
                {m.verdict}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Robustness ranges */}
      <div className="mt-10">
        <h4 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
          Confidence under modifier intensifiers (S2)
        </h4>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Controlled intensifiers were applied to the top three influential words
          and the resulting confidence range recorded. A wide band means the
          model&rsquo;s certainty swings with wording; a flat band at the ceiling
          is its own kind of warning sign.
        </p>

        <div className="mt-6 space-y-5">
          {MODEL_ORDER.map((key) => {
            const r = robustness[key];
            return (
              <div
                key={key}
                className="rounded-lg border border-edge bg-surface p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h5 className="text-sm font-medium text-foreground">
                    {models[key].name}
                  </h5>
                  <span className="font-mono text-[0.96rem] uppercase tracking-wider text-accent">
                    {r.headline}
                  </span>
                </div>

                {r.words ? (
                  <div className="mt-4 space-y-3">
                    {r.words.map((w) => (
                      <div key={w.word} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 font-mono text-xs text-foreground">
                          {w.word}
                        </span>
                        <div className="relative h-2.5 flex-1 rounded-full bg-background">
                          {/* 0.9 reference line */}
                          <span
                            aria-hidden
                            className="absolute inset-y-[-3px] left-[90%] w-px bg-foreground/40"
                          />
                          <motion.span
                            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-warn to-accent"
                            initial={reduced ? false : { width: 0 }}
                            whileInView={{
                              left: `${w.min * 100}%`,
                              width: `${(w.max - w.min) * 100}%`,
                            }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            style={{ left: `${w.min * 100}%` }}
                          />
                        </div>
                        <span className="w-28 shrink-0 text-right font-mono text-[0.96rem] text-muted">
                          {w.min.toFixed(3)}–{w.max.toFixed(3)}
                        </span>
                      </div>
                    ))}
                    <p className="pt-1 text-right font-mono text-[0.9rem] text-muted/70">
                      vertical rule marks 0.90 confidence
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="relative h-2.5 flex-1 rounded-full bg-background">
                      <span className="absolute inset-y-0 right-0 w-1.5 rounded-full bg-accent" />
                    </div>
                    <span className="shrink-0 font-mono text-[0.96rem] text-muted">
                      1.000 flat
                    </span>
                  </div>
                )}

                <p className="mt-4 text-xs leading-relaxed text-muted">
                  {r.summary}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[0.96rem] uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="text-right font-mono text-xs">{value}</span>
    </div>
  );
}
