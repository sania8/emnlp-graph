import type { Metadata } from "next";
import Link from "next/link";
import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { AmrPolicyLab } from "@/components/research/AmrPolicyLab";

export const metadata: Metadata = {
  title: "LLMs for Antimicrobial Resistance Policy Analysis | MSc Thesis",
  description:
    "MSc Artificial Intelligence thesis by Sania Verma for the SPAARTA project: multilingual information extraction and ERIC strategy classification for antimicrobial resistance policy documents.",
};

const metrics = [
  { value: "0.8801", label: "Best Micro-F1", note: "Qwen2.5-7B-Instruct, LoRA fine-tuned, Quote-Then-Judge" },
  { value: "0.4925", label: "Best Macro-F1", note: "Same model; rare strategies remain hard" },
  { value: "221", label: "Policy documents", note: "13 countries, four languages" },
  { value: "228", label: "Expert-coded interventions", note: "Labelled across five coding dimensions" },
];

const problems = [
  { title: "Long, multilingual documents", body: "National action plans run to 200–300 pages, and the evidence for one intervention can be spread across many sections. The collection covers Russian, Chinese, English and Brazilian documents." },
  { title: "Evidence is indirect", body: "A policy rarely names the implementation strategy it uses. A “five-day session with lectures, site visits and demonstrations” has to be read as Facilitation, so keyword matching falls short." },
  { title: "A very fine label space", body: "The ERIC framework has 73 implementation strategies in 9 categories, and one intervention can carry many of them. This makes it a hard multi-label problem with heavy class imbalance." },
];

const frameworks = [
  { name: "Level of implementation", values: "Macro (international, regional, national) · Meso (organisational) · Micro (individual)" },
  { name: "Maturity of implementation", values: "Developed · Implemented · Evaluated" },
  { name: "Focus of intervention", values: "AMR · AMU · AMR/IPC · Infection prevention and control · Antimicrobial stewardship · Public education and awareness · Technology and R&D · Health industry and workforce" },
  { name: "Mechanism", values: "Regulative (legal) · Normative (guidelines) · Cultural-cognitive (behavioural)" },
  { name: "ERIC strategies", values: "73 strategies in 9 categories, such as Train and educate stakeholders, Provide interactive assistance and Utilize financial strategies" },
];

const lanes = [
  { tag: "Retrieval", title: "Retrieval-augmented generation", points: ["Vanilla RAG: 1,000-character chunks, multilingual-e5-large, dense top-20", "Context ablation at 5,000, 20,000 characters and full document", "Modern RAG: hybrid dense and sparse search, reciprocal rank fusion, bge-reranker-v2-m3, two few-shot examples"], result: "Best Micro-F1 21.2 (Modern RAG)" },
  { tag: "Statistical", title: "Statistical and machine learning", points: ["Frequency prior: label frequencies only, no document", "kNN: TF-IDF character n-grams, k = 3, similarity-weighted voting", "Word-pattern learner: character 3–5 grams, one-vs-rest logistic regression", "Five-channel fusion: logistic regression over five signals, keep a strategy when p ≥ 0.70"], result: "Best Micro-F1 54.9 (fusion), Macro-F1 31.4 (word-pattern)" },
  { tag: "LLM", title: "Evidence-grounded LLMs", points: ["LLM summarisation of each intervention before classification", "Quote-Then-Judge: for each candidate label, retrieve evidence, quote the shortest supporting span, then answer YES or NO", "LoRA fine-tuning (r = 16, α = 32, 4-bit NF4) of Qwen2.5-7B, Mistral-7B and Qwen2.5-14B"], result: "Best Micro-F1 88.0, Macro-F1 49.2 (Qwen2.5-7B)" },
];

const dims = [
  { name: "ERIC", micro: 0.88, macro: 0.49 },
  { name: "Focus", micro: 0.84, macro: 0.48 },
  { name: "Level", micro: 0.57, macro: 0.29 },
  { name: "Maturity", micro: 0.35, macro: 0.31 },
  { name: "Mechanism", micro: 0.55, macro: 0.31 },
];

const questions = [
  { q: "RQ1 · Extraction", a: "Documents were converted into structured interventions (209 by direct text extraction, 12 by OCR), but extraction alone did not decide which strategies applied." },
  { q: "RQ2 · RAG", a: "Retrieval alone gave weak classification. Hybrid retrieval beat the baseline, and adding more context did not help on its own." },
  { q: "RQ3 · Statistical", a: "Intervention-level patterns and similarity beat RAG, but struggled with unseen interventions and the 73-label space." },
  { q: "RQ4 · Evidence-grounded LLMs", a: "Asking “does this evidence support this label?” for each candidate gave the strongest results by a clear margin." },
];

export default function AmrThesisPage() {
  return (
    <main className="overflow-hidden">
      <header className="relative border-b border-edge">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-background" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:py-32">
          <Link href="/" className="font-mono text-xs uppercase tracking-[0.25em] text-muted transition-colors hover:text-accent">← Portfolio</Link>
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-accent">MSc thesis · Artificial Intelligence</span>
            <span className="rounded-full border border-edge bg-surface/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] text-muted">SPAARTA project · 2026</span>
          </div>
          <h1 className="mt-7 max-w-5xl text-4xl font-semibold leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">
            Reading policy like an expert: <span className="text-accent">LLMs for antimicrobial resistance</span> policy documents
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
            Countries describe how they will fight antimicrobial resistance in long, multilingual action plans. This thesis tests how well retrieval, statistical learning and fine-tuned language models can find the interventions in those plans and label the implementation strategies behind them.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#interactive-lab" className="rounded-md bg-accent px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">Explore the simulation ↓</a>
            <a href="#results" className="rounded-md border border-edge bg-surface/60 px-5 py-3 text-sm font-medium transition-colors hover:border-accent/40">View results</a>
          </div>
          <dl className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-lg border border-edge bg-surface/75 p-4 backdrop-blur-sm">
                <dd className="font-mono text-2xl text-accent sm:text-3xl">{m.value}</dd>
                <dt className="mt-2 text-xs font-medium uppercase tracking-wider text-foreground">{m.label}</dt>
                <p className="mt-2 text-xs leading-relaxed text-muted">{m.note}</p>
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
            <span className="text-foreground">Author:</span> Sania Verma<br />
            <span className="text-foreground">Supervisor:</span> Dr Tillman Weyde, Reader, Department of Computer Science<br />
            <span className="text-foreground">Project:</span> SPAARTA, with the SPAARTA team at Imperial College London (The Fleming Initiative) and the Health Policy and Medical Sciences team at City St George’s, University of London<br />
            <span className="text-foreground">Data:</span> expert-coded policy data provided with NHS collaborators under a confidentiality agreement
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <SectionHeading eyebrow="Why it matters" title="Policy holds the answers, but not in a form machines can read" description="The WHO estimated that bacterial AMR was associated with more than 4.7 million deaths in 2021, and that about one in six laboratory-confirmed bacterial infections was resistant to treatment in 2023. Action plans show what countries intend to do, and coding them by hand does not scale." />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {problems.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <article className="h-full rounded-lg border border-edge bg-surface p-6 transition-colors hover:border-accent/40">
                <span className="font-mono text-xs text-accent">CHALLENGE 0{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{p.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="interactive-lab" className="scroll-mt-8 border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionHeading eyebrow="Interactive research lab" title="Quote the evidence, then judge" description="Step through the thesis’s best method on a worked example, compare it with simple keyword matching, then watch every method race up the leaderboard. The example is scripted for explanation; no language model runs in the browser." />
          <Reveal className="mt-10"><AmrPolicyLab /></Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <SectionHeading eyebrow="The data" title="221 documents, 228 interventions, five coding dimensions" description="Experts in health policy coded each intervention. Those labels are the ground truth every method is scored against." />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["13", "countries"], ["4", "languages"], ["209 / 12", "documents read by text extraction / OCR"], ["5", "document-level folds, to prevent leakage"]].map(([v, l]) => (
            <Reveal key={l}><div className="h-full rounded-lg border border-edge bg-surface p-5"><p className="font-mono text-2xl text-accent">{v}</p><p className="mt-2 text-xs leading-relaxed text-muted">{l}</p></div></Reveal>
          ))}
        </div>
        <Reveal className="mt-6">
          <div className="overflow-x-auto rounded-lg border border-edge bg-surface">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="border-b border-edge text-xs uppercase tracking-wider text-muted"><tr><th className="px-5 py-4 font-medium">Coding dimension</th><th className="px-5 py-4 font-medium">Labels</th></tr></thead>
              <tbody>{frameworks.map((f) => (<tr key={f.name} className="border-b border-edge last:border-0"><td className="px-5 py-4 font-medium text-foreground">{f.name}</td><td className="px-5 py-4 text-muted">{f.values}</td></tr>))}</tbody>
            </table>
          </div>
        </Reveal>
      </section>

      <section className="border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionHeading eyebrow="The method" title="Three families, tested in order of sophistication" description="The experiments follow a progressive ablation: each family asks whether the next idea adds anything over the last. Statistical methods and fusion were evaluated on the ERIC task, which is the hardest dimension." />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {lanes.map((l, i) => (
              <Reveal key={l.title} delay={i * 0.08}>
                <article className="flex h-full flex-col rounded-lg border border-edge bg-surface p-6">
                  <span className="font-mono text-xs text-accent">{l.tag}</span>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight">{l.title}</h3>
                  <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">{l.points.map((p) => <li key={p}>• {p}</li>)}</ul>
                  <p className="mt-auto border-t border-edge pt-4 text-xs font-medium text-foreground">{l.result}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-6">
            <div className="rounded-lg border border-edge bg-surface p-6 sm:p-8">
              <h3 className="font-semibold">How Quote-Then-Judge reframes the task</h3>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted">Instead of asking a model to list every strategy for a document, each (document, intervention, candidate label) pair becomes its own yes/no question. For that candidate, the system retrieves the top three chunks, picks the best supporting sentence, and the model replies with an evidence quote and an answer. Training used hard negatives (semantically close but wrong labels) alongside easy ones: 9,508 candidate pairs from 180 documents. Evaluation used the held-out Fold 4: 3,560 pairs, of which 469 were positive.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="results" className="mx-auto max-w-7xl scroll-mt-8 px-6 py-20 sm:py-24">
        <SectionHeading eyebrow="Results" title="Grounding each decision in evidence made the difference" description="On ERIC, Micro-F1 rose from 9.2 (Vanilla RAG) to 88.0 (fine-tuned Qwen2.5-7B with Quote-Then-Judge). Macro-F1 reached 49.2, which shows that rare strategies are still often missed." />
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <div className="h-full rounded-lg border border-edge bg-surface p-6 sm:p-8">
              <h3 className="text-lg font-semibold">Performance by coding dimension</h3>
              <p className="mt-1 text-xs text-muted">Fine-tuned Qwen2.5-7B-Instruct with Quote-Then-Judge</p>
              <div className="mt-6 space-y-5">
                {dims.map((d) => (
                  <div key={d.name}>
                    <div className="mb-2 flex items-baseline justify-between text-sm"><span className="text-foreground">{d.name}</span><span className="font-mono text-xs text-muted">Micro {d.micro.toFixed(2)} · Macro {d.macro.toFixed(2)}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-edge"><div className="h-full rounded-full bg-accent" style={{ width: `${d.micro * 100}%` }} /></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-edge"><div className="h-full rounded-full bg-foreground/50" style={{ width: `${d.macro * 100}%` }} /></div>
                  </div>
                ))}
              </div>
              <p className="mt-6 border-t border-edge pt-4 text-xs leading-relaxed text-muted">Thick bar: Micro-F1. Thin bar: Macro-F1. ERIC and Focus are strongest; Maturity is weakest, with the two scores close together at a low level.</p>
            </div>
          </Reveal>
          <div className="grid gap-4">
            {questions.map((r, i) => (
              <Reveal key={r.q} delay={i * 0.06}>
                <div className="rounded-lg border border-edge bg-surface p-5"><p className="font-mono text-xs text-accent">{r.q}</p><p className="mt-2 text-sm leading-relaxed text-muted">{r.a}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal className="mt-6">
          <div className="grid gap-5 rounded-lg border border-edge bg-surface p-6 sm:p-8 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Case study · Malawi AMR strategy 2017–2022</p>
              <p className="mt-4 font-mono text-5xl font-semibold tracking-tight">90.5<span className="text-2xl">%</span></p>
              <p className="mt-1 text-xs text-muted">Micro-F1 with the five-channel fusion model</p>
            </div>
            <div>
              <p className="text-sm leading-relaxed text-muted">On one 128-page document (about 194,000 characters), the system correctly identified 19 ERIC strategies, missed 2 and added 2. It matched “in-service training” to <span className="text-foreground">Conduct ongoing training</span> without the label’s words appearing. One extra prediction, Work with educational institutions, was arguably defensible because the plan mentions a university, so some disagreements reflect interpretation, not plain error.</p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionHeading eyebrow="Interpretation" title="What this work does, and does not, show" description="The results support evidence-grounded classification as a promising direction for policy analysis, not a replacement for expert coders." />
          <Reveal className="mt-10">
            <div className="rounded-lg border border-edge bg-surface p-6 sm:p-8">
              <ul className="space-y-4 text-sm leading-relaxed text-muted">
                <li><span className="font-medium text-foreground">Class imbalance.</span> Micro-F1 is far above Macro-F1 in every experiment, so frequent strategies are handled much better than rare ones.</li>
                <li><span className="font-medium text-foreground">No evidence-level labels.</span> Experts coded which strategies apply, but not the sentence that justifies each one, so evidence retrieval could not be supervised directly.</li>
                <li><span className="font-medium text-foreground">Single held-out fold.</span> Quote-Then-Judge was evaluated on Fold 4 of the five document-level folds, so the estimate has limited statistical support.</li>
                <li><span className="font-medium text-foreground">Confidential data.</span> The policy documents and expert codes cannot be shared publicly, so the results cannot be reproduced from outside the project.</li>
                <li><span className="font-medium text-foreground">Next steps.</span> Evidence-annotated datasets, larger models and long-context retrieval, expert review of ambiguous cases, and evaluation on more countries. A web tool for exploring policies is also proposed.</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-edge">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-xs leading-relaxed text-muted">
            Thesis: Verma, S., “LLM-based Multilingual Information Extraction and Classification for Antimicrobial Resistance Policy Documents,” MSc Artificial Intelligence thesis, supervised by Dr Tillman Weyde, September 2026. Carried out for the SPAARTA project with the SPAARTA team at Imperial College London (The Fleming Initiative) and the Health Policy and Medical Sciences team at City St George’s, University of London. Reported figures are transcribed from the thesis. The simulation is a scripted explanation; no trained model runs on this page.
          </p>
        </div>
      </footer>
    </main>
  );
}
