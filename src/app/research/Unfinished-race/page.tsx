import type { Metadata } from "next";
import Link from "next/link";
import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { MotionPerceptionLab } from "@/components/research/MotionPerceptionLab";
import { PaperFigures } from "@/components/research/PaperFigures";

export const metadata: Metadata = {
  title: "The Unfinished Race | AI Vision and Human Motion Perception",
  description:
    "Research by Sania Verma and Hardik Chadda on motion-defined visual perception, optical flow, and a biologically inspired YOLOv9 pipeline.",
};

const stages = [
  {
    number: "01",
    title: "Raw frames",
    accuracy: "0%",
    width: "0%",
    summary: "Appearance alone is not enough.",
    detail:
      "On the motion-defined kinematograms, the unprocessed input did not provide the model with a useful basis for classifying the moving object.",
  },
  {
    number: "02",
    title: "Dense optical flow",
    accuracy: "13.8%",
    width: "29.2%",
    summary: "Make pixel-level movement visible.",
    detail:
      "Farneback dense optical flow estimates motion across pixels in consecutive frames, producing a representation that emphasises movement rather than relying only on static appearance.",
  },
  {
    number: "03",
    title: "Binarisation",
    accuracy: "22.22%",
    width: "47.0%",
    summary: "Isolate the strongest motion regions.",
    detail:
      "Binarisation turns the motion representation into a more focused mask, helping separate high-motion regions from less relevant visual information.",
  },
  {
    number: "04",
    title: "Denoising",
    accuracy: "31%",
    width: "65.7%",
    summary: "Reduce distracting motion artefacts.",
    detail:
      "Denoising removes small artefacts from the motion-focused representation, making the most informative regions easier for the downstream classifier to use.",
  },
  {
    number: "05",
    title: "High-motion frame selection + YOLOv9",
    accuracy: "47.22%",
    width: "100%",
    summary: "Prioritise frames with the strongest motion signal.",
    detail:
      "The final stage selects frames with the highest density of motion vectors and uses YOLOv9 for classification. This was the strongest reported stage in the paper, across 36 kinematogram videos.",
  },
];

const challenges = [
  {
    title: "Motion without familiar appearance",
    body: "Kinematograms use random-dot fields to represent object movement. Shape and texture cues are deliberately limited, so the task depends on interpreting motion patterns.",
  },
  {
    title: "Video models can miss the signal",
    body: "Direct evaluation of models such as MotionLLM and Video Swin Transformer performed poorly on these stimuli, motivating a representation that makes motion more explicit.",
  },
  {
    title: "Better is not yet human-level",
    body: "The proposed pipeline improved classification, but its 47.22% accuracy remains well below the 96% human recognition result cited from the prior kinematogram study.",
  },
];

export default function UnfinishedRacePage() {
  return (
    <main className="overflow-hidden">
      {/* Hero */}
      <header className="relative border-b border-edge">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-background" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:py-32">
          <Link href="/" className="font-mono text-xs uppercase tracking-[0.25em] text-muted transition-colors hover:text-accent">
            ← Portfolio
          </Link>
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-accent">Research · First author</span>
            <span className="rounded-full border border-edge bg-surface/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] text-muted">Springer · 2026</span>
          </div>
          <h1 className="mt-7 max-w-5xl text-4xl font-semibold leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">
            The Unfinished Race:<br />
            <span className="text-accent">Bridging AI Vision</span> and Human Motion Perception
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
            What happens when a visual system must recognise an object from motion alone? This work evaluates vision models on motion-defined kinematograms and develops a two-stage, biologically inspired pipeline that makes motion more explicit before classification.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#interactive-lab" className="rounded-md bg-accent px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">Explore the simulation ↓</a>
            <a href="#results" className="rounded-md border border-edge bg-surface/60 px-5 py-3 text-sm font-medium transition-colors hover:border-accent/40">View reported results</a>
          </div>
          <dl className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: "47.22%", label: "Best reported pipeline accuracy", note: "YOLOv9 with motion-focused frame selection" },
              { value: "36", label: "Kinematogram videos", note: "Controlled motion-defined stimuli" },
              { value: "5 stages", label: "Progressive refinement", note: "From raw frames to selected motion-rich frames" },
              { value: "96%", label: "Human result cited", note: "From the prior study discussed in the paper" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-edge bg-surface/75 p-4 backdrop-blur-sm">
                <dd className="font-mono text-2xl text-accent sm:text-3xl">{item.value}</dd>
                <dt className="mt-2 text-xs font-medium uppercase tracking-wider text-foreground">{item.label}</dt>
                <p className="mt-2 text-xs leading-relaxed text-muted">{item.note}</p>
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
            <span className="text-foreground">Authors:</span> Sania Verma and Hardik Chadda<br />
            <span className="text-foreground">Research context:</span> Began as a Research Internship at Georgia Tech Institute of Technology(Apr 2024 – Jan 2025) under Dr. Apurva Ratan Murty; the work was later completed with Hardik Chadda<br />
            <span className="text-foreground">Publication:</span> MBCC 2025 proceedings, Springer Nature, 2026<br />
            <span className="text-foreground">DOI:</span>{" "}<a className="underline decoration-accent/50 underline-offset-4 hover:text-accent" href="https://doi.org/10.1007/978-3-032-19966-9_9" target="_blank" rel="noreferrer">10.1007/978-3-032-19966-9_9 ↗</a>
          </p>
        </div>
      </header>
      {/* Research journey */}
    <section className="mx-auto max-w-7xl px-6 pt-20 sm:pt-24">
      <SectionHeading eyebrow="Research journey" title="From a research internship to a published paper" description="How the project developed, and who contributed at each stage." />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {[
          {
            Duration: "Apr 2024 – Jan 2025",
            title: "Research internship, Georgia Tech Institute of Technology, Atlanta, Georgia, U.S.A",
            body: (
              <>
                Worked under the guidance of{" "}
                <a
                  href="https://psychology.gatech.edu/people/apurva-ratan-murty"
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline decoration-accent/50 underline-offset-4 transition-colors hover:text-accent"
                >
                  Dr. Apurva Ratan Murty
                </a>
                , who introduced the problem of motion-defined recognition using kinematograms.
              </>
            ),
          },
          { when: "Following the internship", title: "Continued development", body: "The remaining experiments, analysis and writing were carried forward with Hardik Chadda at Dayalbagh Educational Institute." },
          { when: "2026", title: "Published at MBCC 2025", body: "Springer Nature proceedings, with Sania Verma as first author." },
        ].map((item, i) => (
          <Reveal key={item.title} delay={i * 0.08}>
            <article className="h-full rounded-lg border border-edge bg-surface p-6">
              <span className="font-mono text-xs text-accent">{item.when}</span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
      {/* Research question */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <SectionHeading eyebrow="The research question" title="Can a model recognise what the pixels do not show?" description="Kinematograms represent object trajectories as moving dots, reducing familiar static cues. The challenge is to recover category-level meaning from the dynamics of the scene." />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {challenges.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <article className="h-full rounded-lg border border-edge bg-surface p-6 transition-colors hover:border-accent/40">
                <span className="font-mono text-xs text-accent">QUESTION 0{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Interactive simulation */}
      <section id="interactive-lab" className="border-y border-edge bg-tint scroll-mt-8">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionHeading eyebrow="Interactive research lab" title="See the motion. Reveal the signal." description="Play with a simplified random-dot motion field, then step through the processing stages. This is an explanatory visualisation of the method, not a live execution of the trained research models." />
          <Reveal className="mt-10">
            <MotionPerceptionLab />
          </Reveal>
        </div>
      </section>

      {/* Pipeline */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <SectionHeading eyebrow="The method" title="A five-stage path from raw input to motion-focused classification" description="The paper reports progressive gains as the input is transformed to make movement more salient. Select a stage to inspect the rationale and the reported accuracy." />
        <div className="mt-10 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-3">
            {stages.map((stage, i) => (
              <Reveal key={stage.number} delay={i * 0.04}>
                <a href="#interactive-lab" className="group flex items-center gap-4 rounded-lg border border-edge bg-surface p-4 transition-colors hover:border-accent/40">
                  <span className="font-mono text-xs text-accent">{stage.number}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{stage.title}</span><span className="mt-1 block text-xs text-muted">{stage.summary}</span></span>
                  <span className="font-mono text-sm text-accent">{stage.accuracy}</span>
                </a>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="h-full rounded-lg border border-edge bg-surface p-6 sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Reported progression</p><h3 className="mt-2 text-xl font-semibold">Accuracy at each stage</h3></div>
                <span className="font-mono text-xs text-muted">0–50% scale</span>
              </div>
              <div className="mt-8 space-y-5">
                {stages.map((stage) => (
                  <div key={stage.number}>
                    <div className="mb-2 flex items-baseline justify-between gap-3"><span className="text-sm text-foreground">{stage.title}</span><span className="font-mono text-sm text-accent">{stage.accuracy}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-edge"><div className="h-full rounded-full bg-accent transition-all" style={{ width: stage.width }} /></div>
                  </div>
                ))}
              </div>
              <p className="mt-7 border-t border-edge pt-5 text-xs leading-relaxed text-muted">Values follow Table 3 in the paper. Bar lengths are scaled for visual comparison against the best reported stage, not as percentages of a 100% scale.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Findings */}
      <section id="results" className="border-y border-edge bg-tint scroll-mt-8">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionHeading eyebrow="Findings" title="A measurable improvement — and a substantial gap remains" description="The central result is not that the task is solved, but that making motion explicit helped the classifier recover information that raw-frame baselines missed." />
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-lg border border-edge bg-surface p-6 sm:p-8">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Machine pipeline</p>
                <p className="mt-4 font-mono text-5xl font-semibold tracking-tight">47.22<span className="text-2xl">%</span></p>
                <p className="mt-3 text-sm leading-relaxed text-muted">The final YOLOv9 stage used frames with the highest density of motion vectors. The paper reports this as a substantial improvement over direct baseline evaluations.</p>
                <div className="mt-6 h-2 rounded-full bg-edge"><div className="h-full rounded-full bg-accent" style={{ width: "47.22%" }} /></div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="h-full rounded-lg border border-edge bg-surface p-6 sm:p-8">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Human result cited in the paper</p>
                <p className="mt-4 font-mono text-5xl font-semibold tracking-tight">96<span className="text-2xl">%</span></p>
                <p className="mt-3 text-sm leading-relaxed text-muted">The paper cites 96% human recognition accuracy from the prior kinematogram study. This is contextual comparison, not a matched human-versus-model experiment conducted here.</p>
                <div className="mt-6 h-2 rounded-full bg-edge"><div className="h-full rounded-full bg-foreground/70" style={{ width: "96%" }} /></div>
              </div>
            </Reveal>
          </div>
          <Reveal className="mt-6">
            <div className="rounded-lg border border-edge bg-surface p-6">
              <h3 className="font-semibold">What the results support</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">Motion-aware preprocessing improved performance on this motion-defined dataset. The result does not establish human-level perception, broad generalisation, or robust performance across arbitrary real-world videos.</p>
            </div>
          </Reveal>
        </div>
      </section>
      {/* Paper figures */}
      <section
        id="paper-figures"
        className="border-y border-edge bg-tint"
      >
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionHeading
            eyebrow="Visual research summary"
            title="From motion stimuli to measurable results"
            description="Visual illustrations of the kinematogram task, processing pipeline, and experimental findings."
          />

          <Reveal className="mt-10">
            <PaperFigures />
          </Reveal>
        </div>
      </section>
      {/* Limitations */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <SectionHeading eyebrow="Interpretation" title="What this study does — and does not — claim" description="A research portfolio should make the boundary between evidence and future ambition clear." />
        <Reveal className="mt-10">
          <div className="rounded-lg border border-edge bg-surface p-6 sm:p-8">
            <ul className="space-y-4 text-sm leading-relaxed text-muted">
              <li><span className="font-medium text-foreground">Small dataset.</span> The evaluation uses 36 kinematogram videos; broader evaluation is needed to establish generalisability.</li>
              <li><span className="font-medium text-foreground">Not human-level.</span> The best reported pipeline accuracy is 47.22%, well below the human result cited from prior work.</li>
              <li><span className="font-medium text-foreground">Baseline sensitivity.</span> The tested models struggled with stimuli that lack familiar appearance cues; performance on these stimuli should not be generalised to all video understanding tasks.</li>
              <li><span className="font-medium text-foreground">Future direction.</span> The paper proposes expanding the dataset and analysing fMRI data to investigate neural responses that could inform future vision systems.</li>
            </ul>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-edge">
        <div className="mx-auto max-w-7xl px-6 py-10">
          {" "}Acknowledgement: the problem statement was introduced by{" "}
          <a className="underline underline-offset-4 hover:text-accent" href="https://psychology.gatech.edu/people/apurva-ratan-murty" target="_blank" rel="noreferrer">Dr. Apurva Ratan Murty</a>.
          <p className="text-xs leading-relaxed text-muted">Publication: Verma, S. and Chadda, H., “The Unfinished Race: Bridging the Gap Between AI Vision Models and Human Motion Perception,” MBCC 2025 proceedings, Springer Nature, 2026. DOI: <a className="underline underline-offset-4 hover:text-accent" href="https://doi.org/10.1007/978-3-032-19966-9_9" target="_blank" rel="noreferrer">10.1007/978-3-032-19966-9_9</a>. The motion field is procedurally generated for illustration. Reported results are transcribed from the paper; no trained model runs in this demo.</p>
        </div>
      </footer>
    </main>
  );
}
