"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { caseStudy } from "@/lib/glow";
import { DamperPhysics, PHYSICS_FEATURES } from "./DamperPhysics";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { PerceptionDiagram } from "./PerceptionDiagram";

type View = "perception" | "graph" | "physics" | "reasoner" | "output";

type Stage = {
  id: string;
  layer: string;
  label: string;
  title: string;
  body: string;
  view: View;
  /** Knowledge-graph hops revealed at this stage. */
  hop: number;
  hold: number;
};

const STAGES: Stage[] = [
  {
    id: "input",
    layer: "Layer 1",
    label: "Evidence input",
    title: "A UAV inspection image arrives",
    body: "The pipeline begins with UAV-captured power-line imagery from the InsPLAD benchmark. At this point the system knows nothing beyond pixels — no component, no defect, no severity.",
    view: "perception",
    hop: -1,
    hold: 3400,
  },
  {
    id: "perception",
    layer: "Layer 2",
    label: "Perception",
    title: "Two-stage perception, not one big model",
    body: "A fine-tuned YOLOv11n-cls classifier names the component, flags defect presence and attaches a confidence. A frozen Qwen2-VL-2B-Instruct, steered by many-shot in-context examples rather than weight updates, then supplies the defect type and description. Fine-tuning the VLM directly on 255 images overfitted, which is why it stays frozen.",
    view: "perception",
    hop: -1,
    hold: 6000,
  },
  {
    id: "graph",
    layer: "Layer 3a",
    label: "Graph grounding",
    title: "Every claim is checked against the graph",
    body: "The visual claim is not trusted on its own. It is walked through an expert-curated Neo4j ontology: component to asset, defect to severity, severity to failure mode, failure mode to operational risk, and finally to the maintenance action that severity requires.",
    view: "graph",
    hop: 4,
    hold: 6500,
  },
  {
    id: "physics",
    layer: "Layer 3b",
    label: "Physics grounding",
    title: "An independent, non-visual signal",
    body: "For the Stockbridge damper case study, a reduced-order Simulink model supplies evidence that owes nothing to the image. Eighty runs sweep excitation frequency, wind-driven force amplitude and corrosion factor, each logging physics features for the reasoner.",
    view: "physics",
    hop: 4,
    hold: 6500,
  },
  {
    id: "reasoner",
    layer: "Layer 4",
    label: "Agentic reasoning",
    title: "Retrieve → Bound → Reason → Validate → Author",
    body: "The Reasoner Agent fuses all three streams. A deterministic guardrail computes a severity floor from the more conservative of the visual and physics readings; the LLM may go higher but never lower, because the Validate step clamps it back.",
    view: "reasoner",
    hop: 4,
    hold: 7000,
  },
  {
    id: "output",
    layer: "Layer 5",
    label: "O&M output",
    title: "A work order you can audit backwards",
    body: "The output is a risk assessment, a severity-conditioned maintenance action, a pre-filled SAP PM-style work order, and an end-to-end evidence trace. Every claim can be followed back to the image, the graph path, or the simulation run that supports it.",
    view: "output",
    hop: 4,
    hold: 7000,
  },
];

const REASONER_STEPS = [
  {
    name: "Retrieve",
    detail:
      "Assemble an EvidencePack: VLM outputs, Simulink results, and multi-hop graph context.",
  },
  {
    name: "Bound",
    detail:
      "floor = max(VLM severity, band(risk score)); escalate one level if damping health < 0.15.",
  },
  {
    name: "Reason",
    detail:
      "LLM drafts severity, risk, failure modes, action and citations — physics and graph outrank vision on conflict.",
  },
  {
    name: "Validate",
    detail:
      "Guardrails check severity, ontology-compliant actions, numeric consistency and citations; one re-prompt, then clamp.",
  },
  {
    name: "Author",
    detail:
      "A second LLM call writes the SAP PM-style work order and the O&M report.",
  },
];

export function GlowPipeline() {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reasonStep, setReasonStep] = useState(0);

  const current = STAGES[stage];

  const goToStage = useCallback((target: number) => {
    setStage(target);
    setReasonStep(0);
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

  // Step through the five reasoner sub-steps while that stage is showing.
  useEffect(() => {
    if (current.view !== "reasoner" || reduced) return;
    const i = setInterval(
      () => setReasonStep((s) => Math.min(s + 1, REASONER_STEPS.length - 1)),
      1100,
    );
    return () => clearInterval(i);
  }, [current.view, reduced]);

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface">
      {/* Layer selector */}
      <div className="flex flex-wrap items-center gap-2 border-b border-edge p-3">
        <ol className="flex flex-1 flex-wrap gap-1.5" aria-label="Framework layers">
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
                  {s.layer.replace("Layer ", "L")}
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

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        {/* ----------------Canvas ----------------
            The aspect ratio keeps the panel proportional to the diagrams it
            holds. A fixed pixel height would not track the root font size, so
            the panel would stretch and leave the artwork marooned in space. */}
        <div className="relative min-h-[16rem] overflow-hidden rounded-lg border border-edge bg-surface p-3 sm:aspect-[2.2/1] sm:min-h-0">
          <div className="absolute inset-0 bg-grid opacity-25" />

          <AnimatePresence mode="wait">
            <motion.div
              key={current.view}
              className="relative h-full w-full"
              initial={reduced ? false : { opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, scale: 1.015 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {current.view === "perception" ? (
                <PerceptionDiagram active={current.id === "perception"} />
              ) : null}

              {current.view === "graph" ? (
                <KnowledgeGraph hop={current.hop} reduced={reduced} />
              ) : null}

              {current.view === "physics" ? (
                // The sidebar is sized in rem so it grows with the type scale;
                // a fixed pixel column made the labels wrap and clip.
                <div className="grid h-full gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
                  <DamperPhysics active reduced={reduced} />
                  <div className="self-center rounded-md border border-edge bg-surface-raised p-3">
                    <p className="font-mono text-[0.72rem] uppercase tracking-wider text-accent">
                      Logged per run
                    </p>
                    <ul className="mt-2 space-y-1">
                      {PHYSICS_FEATURES.map((f) => (
                        <li
                          key={f}
                          className="font-mono text-[0.72rem] leading-snug text-muted"
                        >
                          · {f}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 font-mono text-[0.72rem] text-accent">
                      80 runs → SimulationRun
                    </p>
                  </div>
                </div>
              ) : null}

              {current.view === "reasoner" ? (
                <ReasonerView step={reasonStep} reduced={reduced} />
              ) : null}

              {current.view === "output" ? <WorkOrderView reduced={reduced} /> : null}
            </motion.div>
          </AnimatePresence>
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
                {current.layer} · {stage + 1} of {STAGES.length}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                {current.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {current.body}
              </p>
            </motion.div>
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
              Next layer →
            </button>
          </div>
        </div>
      </div>

      <p className="border-t border-edge px-4 py-3 text-xs leading-relaxed text-muted sm:px-6">
        <span className="font-mono uppercase tracking-wider text-accent/80">
          Illustrative simulation ·
        </span>{" "}
        Every label, relation name, model name and numeric value shown comes
        from the paper. The diagrams are original drawings of the described
        architecture, not screenshots of the running system, and nothing
        executes in your browser.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReasonerView({
  step,
  reduced,
}: {
  step: number;
  reduced: boolean | null;
}) {
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-1">
      {REASONER_STEPS.map((s, i) => {
        const on = i <= step;
        return (
          <motion.div
            key={s.name}
            className={`flex gap-3 rounded-md border p-2.5 transition-colors ${
              i === step
                ? "border-accent/50 bg-accent/10"
                : on
                  ? "border-edge bg-surface"
                  : "border-edge/50 bg-transparent"
            }`}
            initial={false}
            animate={{ opacity: on ? 1 : 0.35, x: on ? 0 : -6 }}
            transition={{ duration: reduced ? 0 : 0.4 }}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[0.98rem] ${
                on ? "bg-accent/20 text-accent" : "bg-surface-raised text-muted"
              }`}
            >
              {i + 1}
            </span>
            <div>
              <p
                className={`font-mono text-[1.02rem] uppercase tracking-wider ${
                  on ? "text-accent" : "text-muted"
                }`}
              >
                {s.name}
              </p>
              <p className="mt-1 text-[1.02rem] leading-snug text-muted">
                {s.detail}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function WorkOrderView({ reduced }: { reduced: boolean | null }) {
  const rows = [
    ["Asset", caseStudy.asset],
    ["Component", caseStudy.component],
    ["Defect", caseStudy.defect],
    ["Severity", caseStudy.vlmSeverityLabel],
    ["Risk", `Conductor drop · ${caseStudy.conductorDropRisk}`],
    ["Standard", caseStudy.standard],
    ["Action", caseStudy.action],
  ] as const;

  return (
    <div className="flex h-full items-center justify-center p-2">
      <motion.div
        className="w-full max-w-sm rounded-lg border border-accent/40 bg-surface p-4 backdrop-blur"
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between border-b border-edge pb-2">
          <p className="font-mono text-[0.96rem] uppercase tracking-[0.2em] text-accent">
            SAP PM-style work order
          </p>
          <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[0.98rem] uppercase tracking-wider text-accent">
            Validated
          </span>
        </div>
        <dl className="mt-3 space-y-1.5">
          {rows.map(([k, v], i) => (
            <motion.div
              key={k}
              className="flex justify-between gap-3"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: reduced ? 0 : 0.2 + i * 0.09 }}
            >
              <dt className="font-mono text-[0.96rem] uppercase tracking-wider text-muted">
                {k}
              </dt>
              <dd className="text-right font-mono text-[0.96rem] text-foreground">
                {v}
              </dd>
            </motion.div>
          ))}
        </dl>
        <p className="mt-3 border-t border-edge pt-2 font-mono text-[0.98rem] leading-relaxed text-muted">
          Evidence trace: image → VLM claim → KG path → SimulationRun
          (damping health {caseStudy.dampingHealth}, risk{" "}
          {caseStudy.riskScore}) → action
        </p>
      </motion.div>
    </div>
  );
}
