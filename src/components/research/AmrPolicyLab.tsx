"use client";

import { useEffect, useMemo, useState } from "react";

/* ---------- worked example (paraphrased from the India03 case, thesis Tables 3.1 and 4.8) ---------- */
const PASSAGES = [
  "A five-day contact session included lectures, site visits, practical training, demonstrations and project discussions.",
  "Participants were selected based on qualifications, previous experience and the quality of an AMR research concept.",
  "Participating centres were expected to promote awareness and train other centres.",
  "A multidisciplinary stewardship team included physicians, pharmacists, microbiologists, nurses and hospital administrators.",
  "The programme lasted one year, with multiple contact sessions, workshops and project activities rather than a single training event.",
  "The workshop was hosted by the lead institution in 2012.",
];

type Cand = { name: string; def: string; gold: boolean; qtj: boolean; ev: number | null; alt: number | null; note?: string };
const CANDS: Cand[] = [
  { name: "Identify and prepare champions", def: "Select and prepare individuals who will drive and promote the change in their organisation", gold: true, qtj: true, ev: 1, alt: 2 },
  { name: "Facilitation", def: "A process of enabling and supporting groups through guided interaction, coaching and expert help", gold: true, qtj: true, ev: 0, alt: 4 },
  { name: "Revise professional roles", def: "Shift and expand the roles of professionals, including who does what within a team", gold: true, qtj: true, ev: 3, alt: null },
  { name: "Conduct ongoing training", def: "Plan and deliver training repeatedly over time to build skills", gold: true, qtj: true, ev: 4, alt: 0 },
  { name: "Build a coalition", def: "Recruit and cultivate partnerships among organisations that support the change", gold: false, qtj: false, ev: null, alt: 3 },
  { name: "Conduct educational meetings", def: "Hold meetings for different stakeholder groups to teach them about the change", gold: false, qtj: true, ev: 0, alt: 2, note: "Illustrative error: the evidence is real but only partly supports this label. The thesis notes that false positives arise when evidence is partial." },
  { name: "Develop quality monitoring systems", def: "Set up systems to monitor the quality of the programme and its delivery", gold: false, qtj: false, ev: null, alt: 4 },
  { name: "Use mass media", def: "Use media channels to reach and influence the public", gold: false, qtj: false, ev: null, alt: null },
];

const STOP = new Set("a an and the of to in on for with by or as at is are was were be been that this these those their its it from who what which will can into than then also not but so such how does do did has have had more most other some any each per via".split(" "));
const stem = (w: string) => w.replace(/(ing|ed|es|s|ion)$/, "");
const tok = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w && !STOP.has(w)).map(stem);

function buildLex() { // real TF-IDF cosine between each candidate (name + definition) and each passage
  const docs = [...PASSAGES, ...CANDS.map((c) => `${c.name} ${c.def}`)].map(tok), df: Record<string, number> = {};
  docs.forEach((d) => new Set(d).forEach((w) => (df[w] = (df[w] || 0) + 1)));
  const idf = (w: string) => Math.log((docs.length + 1) / ((df[w] || 0) + 1)) + 1;
  const vec = (t: string[]) => { const v: Record<string, number> = {}; t.forEach((w) => (v[w] = (v[w] || 0) + idf(w))); return v; };
  const cos = (a: Record<string, number>, b: Record<string, number>) => {
    let d = 0, na = 0, nb = 0; for (const k in a) { na += a[k] ** 2; if (b[k]) d += a[k] * b[k]; } for (const k in b) nb += b[k] ** 2;
    return na && nb ? d / Math.sqrt(na * nb) : 0;
  };
  const pv = PASSAGES.map((p) => vec(tok(p)));
  return CANDS.map((c) => { const cv = vec(tok(`${c.name} ${c.def}`)); return pv.map((v) => cos(cv, v)); });
}
// stand-in for embedding retrieval (scripted for the demo, see note in the UI)
const SEM = CANDS.map((c, i) => PASSAGES.map((_, j) => (j === c.ev ? 0.82 : j === c.alt ? 0.52 : 0.08 + ((i * 7 + j * 3) % 5) * 0.02)));

/* ---------- Figure 5.3 results (ERIC task, %) ---------- */
const GROUPS = [{ n: "Retrieval (RAG)", c: "#fb7185" }, { n: "Statistical and ML", c: "#60a5fa" }, { n: "Fine-tuned LLMs (QTJ)", c: "#a78bfa" }];
const METHODS = [
  { n: "Vanilla RAG, 5k chars", g: 0, mi: 9.2, ma: 3.7 }, { n: "Vanilla RAG, 20k chars", g: 0, mi: 10.2, ma: 4.6 }, { n: "Vanilla RAG, full context", g: 0, mi: 9.7, ma: 4.3 },
  { n: "Modern hybrid RAG", g: 0, mi: 21.2, ma: 12.0 }, { n: "Frequency prior", g: 1, mi: 45.7, ma: 13.9 }, { n: "LLM summarisation", g: 1, mi: 51.0, ma: 19.0 },
  { n: "kNN (40k chars)", g: 1, mi: 50.4, ma: 25.7 }, { n: "Word-pattern (80k chars)", g: 1, mi: 54.0, ma: 31.4 }, { n: "Five-channel fusion", g: 1, mi: 54.94, ma: 27.9 },
  { n: "Qwen2.5-14B + QTJ", g: 2, mi: 23.1, ma: 22.9 }, { n: "Mistral-7B + QTJ", g: 2, mi: 86.6, ma: 47.6 }, { n: "Qwen2.5-7B + QTJ (best)", g: 2, mi: 88.0, ma: 49.2 },
];
const PHASES = ["Retrieve evidence", "Quote", "Judge", "Compare with experts"];

export function AmrPolicyLab() {
  const [tab, setTab] = useState<"qtj" | "race">("qtj");
  const [mode, setMode] = useState<"qtj" | "keyword">("qtj");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [thr, setThr] = useState(0.06);
  const [step, setStep] = useState(0);
  const [rev, setRev] = useState(0);
  const lex = useMemo(buildLex, []);

  const total = CANDS.length * 4, done = step >= total;
  const ci = Math.min(CANDS.length - 1, Math.floor(step / 4)), phase = done ? 3 : step % 4, c = CANDS[ci];
  const scores = mode === "qtj" ? SEM : lex;
  const maxLex = (k: number) => Math.max(...lex[k]);
  const pred = (k: number) => (mode === "qtj" ? CANDS[k].qtj : maxLex(k) >= thr);

  useEffect(() => {
    if (!playing) return;
    if (tab === "qtj" && step >= total) return;
    if (tab === "race" && rev >= METHODS.length) return;
    const id = window.setTimeout(() => (tab === "qtj" ? setStep((s) => s + 1) : setRev((r) => r + 1)), (tab === "qtj" ? 900 : 1000) / speed);
    return () => clearTimeout(id);
  }, [playing, tab, step, rev, speed, total]);

  // running confusion counts over decisions already revealed
  let tp = 0, fp = 0, fn = 0;
  CANDS.forEach((cd, k) => { if (k < ci || done || (k === ci && phase >= 2)) { const p = pred(k); if (p && cd.gold) tp++; else if (p) fp++; else if (cd.gold) fn++; } });
  const f1 = tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : 0;

  const shown = scores[ci], top3 = shown.map((s, j) => [s, j]).sort((a, b) => b[0] - a[0]).slice(0, 3).filter((x) => x[0] > 0).map((x) => x[1]);
  const quoteIdx = mode === "qtj" ? c.ev : null, p = pred(ci), correct = p === c.gold;
  const scale = mode === "qtj" ? 0.9 : 0.15;

  const restart = () => { setStep(0); setRev(0); setPlaying(true); };
  const toggle = () => { if (tab === "qtj" && done) { setStep(0); setPlaying(true); } else if (tab === "race" && rev >= METHODS.length) restart(); else setPlaying((v) => !v); };
  const jump = (k: number) => { setStep(Math.max(0, Math.min(total - 1, k * 4))); setPlaying(false); };
  const btn = "rounded-md border border-edge px-3 py-2 text-xs font-medium transition-colors hover:border-accent/50";
  const on = "border-accent/70 bg-accent/10 text-accent";
  const finished = tab === "qtj" ? done : rev >= METHODS.length;

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface">
      {/* tabs + shared controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-4 sm:px-6">
        <div className="flex gap-2" role="tablist" aria-label="Lab view">
          {([["qtj", "Quote-Then-Judge in action"], ["race", "How the methods stack up"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPlaying(true); }} className={`${btn} ${tab === k ? on : ""}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggle} aria-pressed={playing && !finished} className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90">{finished ? "Replay" : playing ? "Pause" : "Play"}</button>
          <button type="button" onClick={restart} className={btn}>Restart</button>
          {[0.5, 1, 2].map((s) => <button key={s} type="button" onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`${btn} ${speed === s ? on : ""}`}>{s}×</button>)}
        </div>
      </div>

      {tab === "qtj" ? (
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm leading-relaxed text-muted">An intervention (an antibiotic stewardship workshop) is checked against eight candidate ERIC strategies, one at a time. Watch the system retrieve evidence, quote it, and judge YES or NO. Switch the decision rule to see why keyword matching is not enough.</p>
            <div className="flex gap-2" role="group" aria-label="Decision rule">
              {([["qtj", "Quote-Then-Judge"], ["keyword", "Keyword match"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => { setMode(k); setStep(0); setPlaying(true); }} aria-pressed={mode === k} className={`${btn} ${mode === k ? on : ""}`}>{l}</button>
              ))}
            </div>
          </div>

          {/* step tracker */}
          <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Current step">
            {PHASES.map((l, k) => (
              <li key={l} className={`rounded-md border px-3 py-2 text-xs transition-colors ${phase === k && !done ? "border-accent/70 bg-accent/10 text-foreground" : k < phase || done ? "border-edge text-foreground" : "border-edge text-muted"}`}>
                <span className="font-mono text-accent">{k + 1}</span> {mode === "keyword" && k === 1 ? "Skip (no quote)" : l}
              </li>
            ))}
          </ol>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            {/* document */}
            <div>
              <p className="text-xs font-medium text-foreground">Policy document passages <span className="font-normal text-muted">· similarity to “{c.name}”</span></p>
              <div className="mt-3 space-y-2">
                {PASSAGES.map((t, j) => {
                  const isTop = phase >= 0 && top3.includes(j), isQuote = phase >= 1 && quoteIdx === j;
                  return (
                    <div key={j} className={`rounded-lg border p-3 transition-colors duration-500 ${isQuote ? "border-amber-400/80 bg-amber-400/10" : isTop ? "border-accent/50" : "border-edge"}`}>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                        <span className="font-mono">P{j + 1}{isQuote && <span className="ml-2 rounded bg-amber-400/20 px-1.5 py-0.5 text-amber-300">evidence</span>}</span>
                        <span className="font-mono">{shown[j].toFixed(2)}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">{t}</p>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-edge"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.min(100, (shown[j] / scale) * 100)}%` }} /></div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{mode === "keyword" ? "Bars show a real TF-IDF keyword similarity, computed live in your browser." : "Bars stand in for embedding similarity and are scripted for this demo. The thesis uses multilingual-e5-large retrieval."}</p>
            </div>

            {/* candidates + console */}
            <div>
              <p className="text-xs font-medium text-foreground">Candidate strategies <span className="font-normal text-muted">· click to jump</span></p>
              <ul className="mt-3 space-y-1.5">
                {CANDS.map((cd, k) => {
                  const shownRes = k < ci || done || (k === ci && phase >= 2), ok = pred(k) === cd.gold;
                  return (
                    <li key={cd.name}>
                      <button type="button" onClick={() => jump(k)} className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-xs transition-colors ${k === ci && !done ? "border-accent/70 bg-accent/10" : "border-edge hover:border-accent/30"}`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${!shownRes ? "bg-edge text-muted" : ok ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>{!shownRes ? k + 1 : ok ? "✓" : "✗"}</span>
                        <span className="min-w-0 flex-1 text-foreground">{cd.name}</span>
                        {shownRes && <span className={`font-mono ${pred(k) ? "text-emerald-300" : "text-muted"}`}>{pred(k) ? "YES" : "NO"}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 rounded-lg border border-edge bg-[#0b1220] p-4 font-mono text-[11px] leading-relaxed text-slate-200" aria-live="polite">
                <p className="text-slate-400">CANDIDATE: <span className="text-slate-100">{c.name}</span></p>
                <p className="text-slate-400">DEFINITION: <span className="text-slate-300">{c.def}</span></p>
                {mode === "qtj" ? (<>
                  <p className="mt-2 text-slate-400">EVIDENCE: <span className={phase >= 1 ? "text-amber-300" : "text-slate-600"}>{phase >= 1 ? (c.ev !== null ? `“${PASSAGES[c.ev]}”` : "NONE") : "…"}</span></p>
                  <p className="text-slate-400">ANSWER: <span className={phase >= 2 ? (p ? "text-emerald-300" : "text-rose-300") : "text-slate-600"}>{phase >= 2 ? (p ? "YES" : "NO") : "…"}</span></p>
                </>) : (
                  <p className="mt-2 text-slate-400">BEST SIMILARITY {maxLex(ci).toFixed(2)} {maxLex(ci) >= thr ? "≥" : "<"} THRESHOLD {thr.toFixed(2)} → <span className={phase >= 2 ? (p ? "text-emerald-300" : "text-rose-300") : "text-slate-600"}>{phase >= 2 ? (p ? "YES" : "NO") : "…"}</span></p>
                )}
                {phase >= 3 && <p className={`mt-2 ${correct ? "text-emerald-300" : "text-rose-300"}`}>EXPERTS: {c.gold ? "applies" : "does not apply"} → {correct ? "correct" : p ? "false positive" : "missed"}</p>}
              </div>
              {phase >= 3 && !correct && mode === "qtj" && c.note && <p className="mt-2 text-[11px] leading-relaxed text-muted">{c.note}</p>}
              {phase >= 3 && !correct && mode === "keyword" && <p className="mt-2 text-[11px] leading-relaxed text-muted">{p ? "A shared word like “programme” is enough to pass the threshold, even though the passage is not evidence for this label." : "The activities are described without the strategy’s words, so there is no keyword overlap."}</p>}

              {mode === "keyword" && (
                <label className="mt-4 block rounded-md border border-edge p-3">
                  <span className="flex justify-between text-xs text-muted"><span>Match threshold</span><span className="font-mono text-foreground">{thr.toFixed(2)}</span></span>
                  <input type="range" min="0.02" max="0.2" step="0.01" value={thr} onChange={(e) => { setThr(Number(e.target.value)); setStep(0); }} className="mt-2 w-full accent-current" aria-label="Keyword match threshold" />
                </label>
              )}
            </div>
          </div>

          {/* score strip */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Correct strategies found", tp, "text-emerald-300"], ["False positives", fp, "text-rose-300"], ["Missed", fn, "text-amber-300"], ["F1 so far", f1.toFixed(2), "text-accent"]].map(([l, v, col]) => (
              <div key={l as string} className="rounded-lg border border-edge p-3"><p className="text-[11px] text-muted">{l}</p><p className={`mt-1 font-mono text-xl font-semibold ${col}`}>{v}</p></div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">Scripted example, not a model run: the passages paraphrase the thesis’s India03 case, the Quote-Then-Judge verdicts are written by hand (including one deliberate error), and no language model runs here. Only the keyword scores are computed live. Scores are over these eight candidates only and are unrelated to the thesis’s reported F1 values.</p>
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          <p className="max-w-3xl text-sm leading-relaxed text-muted">Each bar is a method tested on ERIC strategy classification, in the order the thesis introduced them. Micro-F1 measures overall accuracy across all labels; Macro-F1 averages every label equally, so it drops when rare strategies are missed.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
            {GROUPS.map((g) => <span key={g.n} className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: g.c }} />{g.n}</span>)}
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-6 rounded-sm bg-foreground/60" />Micro-F1</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-6 rounded-sm bg-foreground/40" />Macro-F1</span>
          </div>
          <div className="mt-5 space-y-3">
            {METHODS.map((m, k) => {
              const on_ = k < rev, col = GROUPS[m.g].c;
              return (
                <div key={m.n} className={`grid grid-cols-[8.5rem_1fr] items-center gap-3 transition-opacity duration-500 sm:grid-cols-[12rem_1fr] ${on_ ? "opacity-100" : "opacity-35"}`}>
                  <span className={`text-xs ${k === rev - 1 ? "font-semibold text-foreground" : "text-muted"}`}>{m.n}</span>
                  <div className="space-y-1">
                    {[[m.mi, 10], [m.ma, 6]].map(([v, h], r) => (
                      <div key={r} className="flex items-center gap-2">
                        <div className="flex-1 overflow-hidden rounded-full bg-edge" style={{ height: h }}><div className="h-full rounded-full transition-all duration-1000" style={{ width: on_ ? `${v}%` : "0%", background: col, opacity: r ? 0.6 : 1 }} /></div>
                        <span className="w-10 text-right font-mono text-[11px] text-muted">{on_ ? v.toFixed(1) : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-muted">Values are percentages from the thesis’s ERIC comparison (Figure 5.3); the Qwen2.5-14B point is read off the chart. Fusion Micro-F1 uses the 54.94 given in the text (the chart label shows 54.0). The best configuration, Qwen2.5-7B with LoRA, reports Micro-F1 0.8801 and Macro-F1 0.4925.</p>
        </div>
      )}
    </div>
  );
}
