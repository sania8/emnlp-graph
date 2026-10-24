import type { Metadata } from "next";
import Link from "next/link";
import { GsmilePipeline } from "@/components/research/GsmilePipeline";
import { ModelComparison } from "@/components/research/ModelComparison";
import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import {
  MODEL_ORDER,
  consistency,
  dataset,
  importanceBands,
  models,
  paper,
  researchQuestions,
  takeaways,
} from "@/lib/nldb";

export const metadata: Metadata = {
  title: "When Words Move Markets — Explainable Financial Sentiment Reasoning",
  description:
    "NLDB 2026 research: using GSMILE perturbation explanations to uncover how fine-tuned LLMs actually reason about financial sentiment, and why stability is not the same as correctness.",
};

const stats = [
  { value: "3", label: "Fine-tuned LLMs compared" },
  { value: "GSMILE", label: "Perturbation-based attribution" },
  { value: "5,151", label: "Augmented training sentences" },
  { value: "Springer LNCS", label: "NLDB 2026, vol. 16696" },
];

export default function FinancialSentimentPage() {
  return (
    <main>
      {/* ---------------- Hero ---------------- */}
      <header className="relative overflow-hidden border-b border-edge">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-background" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.25em] text-muted transition-colors hover:text-accent"
          >
            ← Portfolio
          </Link>

          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-[0.9rem] uppercase tracking-[0.2em] text-accent">
              Research
            </span>
            <span className="rounded-full border border-edge px-3 py-1 font-mono text-[0.9rem] uppercase tracking-[0.2em] text-muted">
              {paper.role}
            </span>
            <span className="rounded-full border border-edge px-3 py-1 font-mono text-[0.9rem] uppercase tracking-[0.2em] text-muted">
              Published
            </span>
          </div>

          <h1 className="mt-6 max-w-4xl text-3xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            When Words Move Markets: interpretable{" "}
            <span className="text-accent">behavioural and robustness</span>{" "}
            analysis of LLMs for financial sentiment reasoning
          </h1>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted">
            {paper.venue}
            <br />
            {paper.series}
          </p>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted">
            Three fine-tuned LLMs can agree on a sentiment label and still be
            reasoning in completely different ways. This work uses perturbation
            explanations to open them up — showing which tokens a prediction
            actually rests on, how the models behave when those tokens are
            removed, and why deterministic output is not the same thing as a
            trustworthy one.
          </p>

          <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-edge bg-surface p-4 backdrop-blur-sm"
              >
                <dd className="font-mono text-xl text-accent">{s.value}</dd>
                <dt className="mt-1 text-xs uppercase tracking-wider text-foreground">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* ---------------- Research questions ---------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <SectionHeading
          eyebrow="The problem"
          title="Accuracy is not an explanation"
          description="Financial language hides its sentiment in structure — hedging, concession, framing of time. A model can score well on the label and still be reading the sentence in a way no analyst would endorse, which is a problem once auditability becomes a regulatory requirement."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {researchQuestions.map((rq, i) => (
            <Reveal key={rq.id} delay={i * 0.08}>
              <div className="h-full rounded-lg border border-edge bg-surface p-6 transition-colors hover:border-accent/30">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
                  {rq.id}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-foreground">
                  {rq.q}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- GSMILE walkthrough ---------------- */}
      <section className="border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <SectionHeading
            eyebrow="Interactive walkthrough"
            title="Watch a prediction get taken apart"
            description="Follow one sentence through the GSMILE procedure: prompt, forward pass to the label logits, thirty perturbed variants, a surrogate fit that yields token attributions, and finally the ablation that tests whether the top token actually mattered. Switch model and sentence to compare."
          />
          <Reveal className="mt-10">
            <GsmilePipeline />
          </Reveal>

          <Reveal className="mt-8">
            <div className="rounded-lg border border-edge bg-surface-raised p-5">
              <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
                Importance banding
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Scores are normalised to the maximum within each sentence, then
                banded:
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {importanceBands.map((b) => (
                  <span
                    key={b.level}
                    className="rounded-full border border-edge px-3 py-1.5 font-mono text-[0.96rem] text-muted"
                  >
                    {b.level}
                    <span className="ml-2 text-accent">{b.range}</span>
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Model comparison ---------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <SectionHeading
          eyebrow="Behavioural comparison"
          title="Same sentence, three reasoning styles"
          description="The same ablation applied to all three models. Where the label moves — and where it stubbornly refuses to — is what separates a model that is reading context from one that is pattern-matching."
        />
        <Reveal className="mt-10">
          <ModelComparison />
        </Reveal>
      </section>

      {/* ---------------- Stability ---------------- */}
      <section className="border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <SectionHeading
            eyebrow="Stability check"
            title="Deterministic, and still wrong"
            description={`Five statements were each queried ${consistency.runsEach} times under identical conditions, following the self-verification idea behind SelfCheckGPT.`}
          />

          <Reveal className="mt-10">
            {/* Scrolls horizontally below ~34rem rather than squeezing the
                statement column until the header clips. */}
            <div className="overflow-x-auto rounded-lg border border-edge">
              <div className="min-w-[34rem]">
              <div className="grid grid-cols-[minmax(0,1fr)_3rem_3rem_3rem_3rem] gap-2 border-b border-edge bg-surface-raised px-4 py-3 font-mono text-[0.9rem] uppercase tracking-wider text-muted">
                <span>Statement</span>
                <span className="text-center">Truth</span>
                <span className="text-center">Mis</span>
                <span className="text-center">Gem</span>
                <span className="text-center">Qwen</span>
              </div>
              {consistency.statementsTable.map((row) => (
                <div
                  key={row.text}
                  className={`grid grid-cols-[minmax(0,1fr)_3rem_3rem_3rem_3rem] items-center gap-2 border-b border-edge px-4 py-3 last:border-b-0 ${
                    row.flagged ? "bg-danger/5" : ""
                  }`}
                >
                  <span className="truncate text-xs text-muted" title={row.text}>
                    {row.text}
                  </span>
                  <span className="text-center font-mono text-[0.96rem] text-foreground">
                    {row.truth}
                  </span>
                  <span className="text-center font-mono text-[0.96rem] text-muted">
                    {row.mistral}
                  </span>
                  <span className="text-center font-mono text-[0.96rem] text-muted">
                    {row.gemma}
                  </span>
                  <span
                    className={`text-center font-mono text-[0.96rem] ${
                      row.flagged ? "text-danger" : "text-muted"
                    }`}
                  >
                    {row.qwen}
                    {row.flagged ? "*" : ""}
                  </span>
                </div>
              ))}
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted">
              <span className="font-mono text-[0.96rem] uppercase tracking-wider text-danger">
                * consistent misclassification ·
              </span>{" "}
              {consistency.finding}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Setup ---------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Data"
              title="A small, deliberately balanced corpus"
              description="Financial PhraseBank at the 75% annotator-agreement level, chosen to balance label reliability against dataset size, then synonym-augmented to remove the class imbalance."
            />
            <Reveal className="mt-8">
              <dl className="divide-y divide-[var(--border)] border-y border-edge">
                {dataset.map((d) => (
                  <div key={d.label} className="flex justify-between py-3">
                    <dt className="text-sm text-muted">{d.label}</dt>
                    <dd className="font-mono text-sm text-foreground">
                      {d.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <div>
            <SectionHeading
              eyebrow="Training"
              title="Parameter-efficient fine-tuning"
              description="All three models were adapted with LoRA or QLoRA, with cross-entropy applied only to label tokens so the instruction text never contributed gradients."
            />
            <Reveal className="mt-8">
              <div className="space-y-4">
                {MODEL_ORDER.map((k) => {
                  const m = models[k];
                  return (
                    <details
                      key={k}
                      className="group rounded-lg border border-edge bg-surface p-4"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                        <span>
                          <span className="text-sm font-medium text-foreground">
                            {m.name}
                          </span>
                          <span className="ml-2 font-mono text-[0.96rem] text-muted">
                            {m.vendor} · {m.params}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className="shrink-0 font-mono text-accent transition-transform duration-300 group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <p className="mt-3 text-xs leading-relaxed text-muted">
                        {m.note}
                      </p>
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                        {m.config.map((c) => (
                          <div
                            key={c.label}
                            className="flex justify-between gap-2 border-b border-edge/60 pb-1.5"
                          >
                            <dt className="font-mono text-[0.9rem] uppercase tracking-wider text-muted">
                              {c.label}
                            </dt>
                            <dd className="font-mono text-[0.96rem] text-foreground">
                              {c.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- Takeaways ---------------- */}
      <section className="border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <SectionHeading
            eyebrow="Findings"
            title="What the explanations actually showed"
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {takeaways.map((t, i) => (
              <Reveal key={t.title} delay={i * 0.06}>
                <div className="h-full rounded-lg border border-edge bg-surface p-6 transition-colors hover:border-accent/30">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {t.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {t.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8">
            <div className="rounded-lg border border-edge bg-surface-raised p-6">
              <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
                Stated limitations and future work
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted">
                <li>
                  Local explanation analysis centres on two sentences and a
                  five-statement stability check — a deliberately close reading
                  rather than a large-scale benchmark.
                </li>
                <li>
                  Attributions are correlational. The paper calls for causal
                  verification techniques to separate genuine causal token
                  contributions from merely correlated ones.
                </li>
                <li>
                  Future directions include larger and more diverse financial
                  datasets, larger LLMs, multi-modal financial analysis, and
                  adaptive perturbation strategies.
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Citation ---------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <SectionHeading eyebrow="Publication" title="Authors and citation" />

        <Reveal className="mt-10">
          <div className="rounded-xl border border-edge bg-surface p-6 sm:p-8">
            <h3 className="text-xl font-semibold leading-snug tracking-tight">
              {paper.title}
            </h3>

            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
              {paper.authors.map((a, i) => (
                <li
                  key={a.name}
                  className="flex gap-3 rounded-lg border border-edge bg-surface-raised p-3"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-[0.9rem] text-accent">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-sm text-foreground">
                      {a.name}
                      {i === 0 ? (
                        <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[0.9rem] uppercase tracking-wider text-accent">
                          First author
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">
                      {a.affiliation}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <dl className="mt-8 divide-y divide-[var(--border)] border-y border-edge">
              <div className="flex flex-wrap justify-between gap-2 py-3">
                <dt className="text-sm text-muted">Conference</dt>
                <dd className="text-right text-sm text-foreground">
                  {paper.venue}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 py-3">
                <dt className="text-sm text-muted">Published in</dt>
                <dd className="text-right text-sm text-foreground">
                  {paper.series}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 py-3">
                <dt className="text-sm text-muted">DOI</dt>
                <dd className="text-right">
                  <a
                    href={paper.doi}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-accent underline-offset-4 hover:underline"
                  >
                    10.1007/978-3-032-29532-3_19
                  </a>
                </dd>
              </div>
            </dl>

            <a
              href={paper.doi}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-5 py-3 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              Read the paper on SpringerLink
              <span aria-hidden>↗</span>
            </a>

            <p className="mt-6 text-xs leading-relaxed text-muted">
              {paper.disclaimer}
            </p>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-edge">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-xs leading-relaxed text-muted">
            All predictions, confidences, attribution scores, hyperparameters and
            ablation outcomes on this page are taken from the published paper.
            The network diagrams are original illustrations of the described
            method rather than reproductions of the paper&rsquo;s figures, and no
            model runs in your browser.
          </p>
        </div>
      </footer>
    </main>
  );
}
