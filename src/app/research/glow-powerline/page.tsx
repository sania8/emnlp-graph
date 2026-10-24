import type { Metadata } from "next";
import Link from "next/link";
import { GlowPipeline } from "@/components/research/GlowPipeline";
import { GuardrailLab } from "@/components/research/GuardrailLab";
import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { corpus, ontology, paper, results } from "@/lib/glow";

export const metadata: Metadata = {
  title: "Graph-Grounded Multimodal Agent for Power-Line O&M",
  description:
    "GLOW@ISWC'26 research: fusing a two-stage perception pipeline, an expert-curated Neo4j knowledge graph and physics-informed Simulink evidence into auditable power-line maintenance decisions.",
};

const problems = [
  {
    title: "Vision-language models hallucinate",
    body: "A VLM will describe a missing cap or a corroded fitting fluently, and will do so just as fluently when it is wrong. In a safety-critical setting, plausible prose is not evidence.",
  },
  {
    title: "RAG cannot express engineering structure",
    body: "Retrieved passages are text, not a model of the asset. They cannot represent defect-to-failure-mode, severity-to-action or component-to-standard dependencies in an auditable way.",
  },
  {
    title: "A detection is not a decision",
    body: "Knowing a defect exists says nothing about which component is affected, how severe it is, which standard applies, what operational risk it carries, or what the crew should actually do.",
  },
];

export default function GlowPage() {
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
            <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-[0.96rem] uppercase tracking-[0.2em] text-accent">
              Research
            </span>
            <span className="rounded-full border border-edge px-3 py-1 font-mono text-[0.96rem] uppercase tracking-[0.2em] text-muted">
              {paper.role}
            </span>
          </div>

          <h1 className="mt-6 max-w-4xl text-3xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            Graph-Grounded Multimodal Agent for{" "}
            <span className="text-accent">Trustworthy</span> Power-Line
            Operations and Maintenance
          </h1>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted">
            {paper.venue}
            <br />
            {paper.location}
          </p>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted">
            UAV inspection can find defects. It cannot, on its own, justify a
            maintenance decision. This work fuses three independent evidence
            streams — a structured visual claim, an expert-curated knowledge
            graph, and physics-informed simulation — behind deterministic
            guardrails, so every work order is traceable from image to action.
          </p>

          <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {results.slice(0, 4).map((r) => (
              <div
                key={r.label}
                className="rounded-lg border border-edge bg-surface p-4 backdrop-blur-sm"
              >
                <dd className="font-mono text-2xl text-accent">{r.value}</dd>
                <dt className="mt-1 text-xs uppercase tracking-wider text-foreground">
                  {r.label}
                </dt>
                <p className="mt-1.5 text-[1.02rem] leading-snug text-muted">
                  {r.note}
                </p>
              </div>
            ))}
          </dl>

          <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
            <span className="text-foreground">Authors:</span> {paper.authors}
            <br />
            <span className="text-foreground">Affiliations:</span>{" "}
            {paper.affiliations}
          </p>
        </div>
      </header>

      {/* ---------------- Problem ---------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <SectionHeading
          eyebrow="The problem"
          title="Why fluent descriptions are not enough"
          description="Power-line O&M is safety-critical. A recommendation has to be defensible, which means it has to be traceable to something other than a language model's confidence."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {problems.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="h-full rounded-lg border border-edge bg-surface p-6 transition-colors hover:border-accent/30">
                <h3 className="text-lg font-semibold tracking-tight">
                  {p.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {p.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- Pipeline simulation ---------------- */}
      <section className="border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <SectionHeading
            eyebrow="Framework walkthrough"
            title="Five layers, from pixels to a work order"
            description="Step through the architecture: evidence input, two-stage perception, graph and physics grounding, agentic reasoning under guardrails, and the audited O&M output."
          />
          <Reveal className="mt-10">
            <GlowPipeline />
          </Reveal>
        </div>
      </section>

      {/* ---------------- Guardrail lab ---------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <SectionHeading
          eyebrow="Try the guardrail"
          title="The rule that stops the model talking itself down"
          description="The Bound step is deterministic arithmetic, not a prompt. Move the sliders to see how the visual claim and the physics reading combine into a severity floor, and which maintenance action the graph then requires."
        />
        <Reveal className="mt-10">
          <GuardrailLab />
        </Reveal>
      </section>

      {/* ---------------- Corpus & ontology ---------------- */}
      <section className="border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow="Evidence base"
                title="What went into the graph"
                description="The full InsPLAD inventory was ingested, alongside a small, high-integrity annotated corpus and the physics runs."
              />
              <Reveal className="mt-8">
                <dl className="divide-y divide-[var(--border)] border-y border-edge">
                  {corpus.map((c) => (
                    <div key={c.label} className="flex justify-between py-3">
                      <dt className="text-sm text-muted">{c.label}</dt>
                      <dd className="font-mono text-sm text-foreground">
                        {c.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Of the 255 curated images, 85 were annotated by certified
                  high-voltage inspection specialists and 170 by an LLM
                  annotator selected by an independent LLM judge against the
                  human ground truth.
                </p>
              </Reveal>
            </div>

            <div>
              <SectionHeading
                eyebrow="Ontology"
                title="What the schema encodes"
                description="Implemented in Neo4j and encoded in Cypher, with an automated validator enforcing structural invariants."
              />
              <Reveal className="mt-8">
                <dl className="divide-y divide-[var(--border)] border-y border-edge">
                  {ontology.map((o) => (
                    <div key={o.label} className="flex justify-between py-3">
                      <dt className="text-sm text-muted">{o.label}</dt>
                      <dd className="font-mono text-sm text-foreground">
                        {o.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Invariants checked include exactly one severity-conditioned
                  REQUIRES edge per (defect, severity) pair, no defect linked to
                  severity level 0, and a complete 0→1→2→3 escalation chain.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Results & limitations ---------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <SectionHeading
          eyebrow="Results"
          title="Reported performance, and what it does not claim"
          description="Numbers below are from the paper's evaluation. The scope of each is stated alongside it, because the scope is the point."
        />

        <Reveal className="mt-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <div
                key={r.label}
                className="rounded-lg border border-edge bg-surface p-5"
              >
                <p className="font-mono text-2xl text-accent">{r.value}</p>
                <p className="mt-1 text-sm text-foreground">{r.label}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {r.note}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-10">
          <div className="rounded-lg border border-edge bg-surface-raised p-6">
            <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
              Stated limitations
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
              <li>
                <span className="text-foreground">Faithfulness is not correctness.</span>{" "}
                The 0.88 score measures the fraction of claims supported by the
                retrieved graph context. It does not assess correctness against
                the physical asset, the image, engineering standards, or the
                optimal maintenance action.
              </li>
              <li>
                <span className="text-foreground">Small evaluation.</span> 51
                validation images and 11 generated work orders.
              </li>
              <li>
                <span className="text-foreground">Narrow corpus.</span> 255
                annotated images limits generalisation to unseen defect
                characteristics, imaging conditions and rarer classes — and is
                what precluded fine-tuning the VLM.
              </li>
              <li>
                <span className="text-foreground">Single environment.</span>{" "}
                Developed and evaluated on data from one operational setting;
                performance elsewhere is unvalidated.
              </li>
              <li>
                <span className="text-foreground">Structural, not semantic, validation.</span>{" "}
                The ontology validator enforces schema conformity but does not
                guarantee the semantic correctness of retrieved facts or
                image-to-graph mappings.
              </li>
              <li>
                <span className="text-foreground">Scoped physics.</span> The
                Simulink model is a reduced-order evidence generator for one
                component, not a certified mechanical design simulator.
              </li>
            </ul>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-edge">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-xs leading-relaxed text-muted">
            All figures, model names, relation names and thresholds on this page
            are taken from the paper. The diagrams are original illustrations of
            the described architecture rather than reproductions of the paper&rsquo;s
            figures, and no model runs in your browser — the only computation
            performed here is the deterministic severity-floor rule in the
            guardrail section.
          </p>
        </div>
      </footer>
    </main>
  );
}
