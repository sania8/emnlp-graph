"use client";

import { useState } from "react";
import {
  CORROSION_ACTION,
  SEVERITY_ORDER,
  type Severity,
  caseStudy,
  severityFloor,
} from "@/lib/glow";

/**
 * A live implementation of the deterministic Bound guardrail from the paper:
 *
 *   floor = max(VLM severity, band(simulation risk score))
 *   escalate one level if damping health index < 0.15, capped at severe
 *   bands: < 0.35 minor · 0.35–0.60 moderate · >= 0.60 severe
 *
 * This is the real rule, computed in the browser. It is not an LLM and not a
 * re-creation of the full agent — just the arithmetic that bounds it.
 */
export function GuardrailLab() {
  const [vlm, setVlm] = useState<Severity>(caseStudy.vlmSeverity);
  const [risk, setRisk] = useState<number>(caseStudy.riskScore);
  const [damping, setDamping] = useState<number>(caseStudy.dampingHealth);

  const { floor, escalated, banded } = severityFloor(vlm, risk, damping);
  const action = CORROSION_ACTION[floor];
  const isPaperCase =
    vlm === caseStudy.vlmSeverity &&
    Math.abs(risk - caseStudy.riskScore) < 1e-9 &&
    Math.abs(damping - caseStudy.dampingHealth) < 1e-9;

  return (
    <div className="grid gap-6 rounded-xl border border-edge bg-surface p-5 sm:p-6 lg:grid-cols-2">
      {/* ---------------- Inputs ---------------- */}
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[1.02rem] uppercase tracking-wider text-muted">
            VLM severity claim
          </p>
          <div className="mt-2 inline-flex rounded-md border border-edge p-0.5">
            {SEVERITY_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setVlm(s)}
                aria-pressed={vlm === s}
                className={`rounded px-3 py-1.5 font-mono text-[1.02rem] uppercase tracking-wider transition-colors ${
                  vlm === s
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-[1.02rem] uppercase tracking-wider text-muted">
            Simulation risk score
            <span className="text-foreground">{risk.toFixed(3)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={risk}
            onChange={(e) => setRisk(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
          <span className="mt-1 block font-mono text-[0.96rem] text-muted">
            bands: &lt;0.35 minor · 0.35–0.60 moderate · ≥0.60 severe → banded as{" "}
            <span className="text-accent">{banded}</span>
          </span>
        </label>

        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-[1.02rem] uppercase tracking-wider text-muted">
            Damping health index
            <span className="text-foreground">{damping.toFixed(3)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={damping}
            onChange={(e) => setDamping(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
          <span className="mt-1 block font-mono text-[0.96rem] text-muted">
            below 0.15 escalates one level →{" "}
            <span className={escalated ? "text-accent" : ""}>
              {escalated ? "escalating" : "no escalation"}
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => {
            setVlm(caseStudy.vlmSeverity);
            setRisk(caseStudy.riskScore);
            setDamping(caseStudy.dampingHealth);
          }}
          className="rounded-md border border-edge px-3 py-2 font-mono text-[1.02rem] uppercase tracking-wider text-muted transition-colors hover:border-accent/40 hover:text-accent"
        >
          ↺ Reset to the paper&rsquo;s case study
        </button>
      </div>

      {/* ---------------- Output ---------------- */}
      <div className="flex flex-col justify-center rounded-lg border border-edge bg-surface-raised p-5">
        <p className="font-mono text-[1.02rem] uppercase tracking-wider text-muted">
          Severity floor
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-accent">
          {floor}
        </p>

        <p className="mt-5 font-mono text-[1.02rem] uppercase tracking-wider text-muted">
          Action required by the graph
        </p>
        <p className="mt-1 text-lg font-medium text-foreground">{action}</p>

        <div className="mt-5 space-y-1.5 border-t border-edge pt-4 font-mono text-[0.96rem] leading-relaxed text-muted">
          <p>
            max(<span className="text-foreground">{vlm}</span>,{" "}
            <span className="text-foreground">{banded}</span>)
            {escalated ? " → escalated one level" : ""} ={" "}
            <span className="text-accent">{floor}</span>
          </p>
          <p>
            The LLM may assess higher than this floor, but the Validate step
            clamps anything lower.
          </p>
        </div>

        {isPaperCase ? (
          <p className="mt-4 rounded border border-accent/30 bg-accent/5 px-3 py-2 font-mono text-[0.96rem] leading-relaxed text-accent">
            These are the paper&rsquo;s case-study values: a corroded
            Stockbridge damper on the {caseStudy.asset}, resolving to{" "}
            {caseStudy.action.toLowerCase()} under {caseStudy.standard}.
          </p>
        ) : (
          <p className="mt-4 rounded border border-edge px-3 py-2 font-mono text-[0.96rem] leading-relaxed text-muted">
            Exploring hypothetical inputs. Only the reset values appear in the
            paper; the rest show how the rule behaves.
          </p>
        )}
      </div>
    </div>
  );
}
