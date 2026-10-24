import type { Metadata } from "next";
import Link from "next/link";
import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { HeartSoundLab } from "@/components/research/HeartSoundLab";

export const metadata: Metadata = {
  title: "Spectrogram-Driven Heart Sound Classification | YOLOv8",
  description:
    "First-author research by Sania Verma and Hardik Chadda on phonocardiogram classification using spectrograms and YOLOv8.",
};

const metrics = [
  { value: "94.5%", label: "YOLOv8 accuracy", note: "Reported on PhysioNet/CinC 2016" },
  { value: "0.95", label: "F1-score", note: "Reported in Table II" },
  { value: "0.97", label: "Recall", note: "Reported in Table II" },
  { value: "0.83", label: "Matthews correlation", note: "MCC reported in Table II" },
];

const models = [
  { name: "LSTM", accuracy: "88.9%", score: 88.9, f1: "0.88", precision: "0.87", recall: "0.89", mcc: "0.77", note: "Raw audio" },
  { name: "ResNet-18", accuracy: "85.8%", score: 85.8, f1: "0.92", precision: "0.99", recall: "0.85", mcc: "0.50", note: "Spectrogram images" },
  { name: "YOLOv8", accuracy: "94.5%", score: 94.5, f1: "0.95", precision: "0.95", recall: "0.97", mcc: "0.83", note: "Spectrogram images" },
];

const pipeline = [
  {
    number: "01",
    title: "Heart sound recording",
    body: "Start with a phonocardiogram (PCG) recording in WAV format. The paper evaluates recordings from the PhysioNet/CinC 2016 dataset.",
  },
  {
    number: "02",
    title: "Low-pass filtering",
    body: "A 200 Hz cutoff low-pass filter is described for reducing background noise before the recordings are processed.",
  },
  {
    number: "03",
    title: "STFT spectrogram",
    body: "Short-Time Fourier Transform converts the signal into a time–frequency image. The reported settings use a 2,048-sample window, 512-sample hop, and 2,048 FFT points.",
  },
  {
    number: "04",
    title: "Model classification",
    body: "The spectrogram is passed to YOLOv8 to classify the recording as normal or abnormal. LSTM on raw audio and ResNet-18 on spectrograms provide comparison baselines.",
  },
  {
    number: "05",
    title: "Prediction and confidence",
    body: "The described application displays the predicted class and confidence score. This portfolio visualisation does not run the trained model or provide a medical assessment.",
  },
];

export default function SpectrogramDrivenPage() {
  return (
    <main className="overflow-hidden">
      <header className="relative border-b border-edge">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-background" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:py-32">
          <Link href="/" className="font-mono text-xs uppercase tracking-[0.25em] text-muted transition-colors hover:text-accent">
            ← Portfolio
          </Link>
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-accent">
              Research · First author
            </span>
            <span className="rounded-full border border-edge bg-surface/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] text-muted">
              IEEE · ICSIDP 2024
            </span>
          </div>
          <h1 className="mt-7 max-w-5xl text-4xl font-semibold leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">
            Spectrogram-Driven Heart Sound Classification
            <span className="block mt-3 text-accent">using YOLOv8</span>
            <span className="mt-3 block text-2xl font-medium leading-tight tracking-tight text-muted sm:text-3xl">
              for Mobile Health Monitoring
            </span>
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
            Can heart sounds be classified efficiently by turning audio into images? This work compares a raw-audio LSTM with spectrogram-based ResNet-18 and YOLOv8 models for normal-versus-abnormal phonocardiogram classification.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#interactive-lab" className="rounded-md bg-accent px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
              Explore the pipeline ↓
            </a>
            <a href="#results" className="rounded-md border border-edge bg-surface/60 px-5 py-3 text-sm font-medium transition-colors hover:border-accent/40">
              View reported results
            </a>
          </div>
          <dl className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((item) => (
              <div key={item.label} className="rounded-lg border border-edge bg-surface/75 p-4 backdrop-blur-sm">
                <dd className="font-mono text-2xl text-accent sm:text-3xl">{item.value}</dd>
                <dt className="mt-2 text-xs font-medium uppercase tracking-wider text-foreground">{item.label}</dt>
                <p className="mt-2 text-xs leading-relaxed text-muted">{item.note}</p>
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
            <span className="text-foreground">Authors:</span> Sania Verma and Hardik Chadda<br />
            <span className="text-foreground">Publication:</span> 2024 IEEE International Conference on Signal, Information and Data Processing (ICSIDP)<br />
            <span className="text-foreground">DOI:</span>{" "}
            <a className="underline decoration-accent/50 underline-offset-4 hover:text-accent" href="https://doi.org/10.1109/ICSIDP62679.2024.10868008" target="_blank" rel="noreferrer">
              10.1109/ICSIDP62679.2024.10868008 ↗
            </a>
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <SectionHeading
          eyebrow="The research question"
          title="What if heart sounds were treated as visual patterns?"
          description="A phonocardiogram is an audio signal. A spectrogram represents how its frequency content changes over time, making it suitable for image-based models to learn patterns associated with normal and abnormal heart sounds."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { title: "Audio is sequential", body: "The LSTM baseline operates on raw WAV recordings and models the signal as a sequence." },
            { title: "Spectrograms expose structure", body: "STFT maps time and frequency into a visual representation that can be processed by image-based architectures." },
            { title: "Efficiency matters", body: "The study investigates whether YOLOv8 can offer a useful balance of classification performance and fast inference for potential mobile-health applications." },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <article className="h-full rounded-lg border border-edge bg-surface p-6 transition-colors hover:border-accent/40">
                <span className="font-mono text-xs text-accent">MOTIVATION 0{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="interactive-lab" className="scroll-mt-8 border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionHeading
            eyebrow="Interactive research lab"
            title="From a sound wave to a model prediction"
            description="Explore a conceptual walkthrough of the stages described in the paper. The waveform and spectrogram are generated for illustration; this demo does not accept audio files or run trained model inference."
          />
          <Reveal className="mt-10">
            <HeartSoundLab />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <SectionHeading
          eyebrow="The method"
          title="Five steps from PCG recording to classification"
          description="The paper describes two input paths: an LSTM trained on raw audio and image-based models trained on spectrograms."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pipeline.map((stage, i) => (
            <Reveal key={stage.number} delay={i * 0.05}>
              <article className="h-full rounded-lg border border-edge bg-surface p-6">
                <span className="font-mono text-xs text-accent">{stage.number} / PIPELINE</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{stage.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{stage.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted">
          Spectrogram settings reported in the paper: 2,048-sample window, 512-sample hop (1,536-sample overlap), 2,048 FFT points, and output images of approximately 496 × 369 pixels.
        </p>
      </section>

      <section id="results" className="scroll-mt-8 border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionHeading
            eyebrow="Reported results"
            title="YOLOv8 led on accuracy, recall and MCC"
            description="The paper's Table II compares an LSTM on raw audio with ResNet-18 and YOLOv8 on spectrogram images. Values below are transcribed from that table."
          />
          <Reveal className="mt-10">
            <div className="overflow-x-auto rounded-lg border border-edge bg-surface">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="border-b border-edge bg-surface/70 text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-5 py-4 font-medium">Model / input</th>
                    <th className="px-5 py-4 font-medium">Accuracy</th>
                    <th className="px-5 py-4 font-medium">F1</th>
                    <th className="px-5 py-4 font-medium">Precision</th>
                    <th className="px-5 py-4 font-medium">Recall</th>
                    <th className="px-5 py-4 font-medium">MCC</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr key={model.name} className={`border-b border-edge last:border-0 ${model.name === "YOLOv8" ? "bg-accent/5" : ""}`}>
                      <td className="px-5 py-4">
                        <span className={`block font-medium ${model.name === "YOLOv8" ? "text-accent" : "text-foreground"}`}>{model.name}</span>
                        <span className="mt-1 block text-xs text-muted">{model.note}</span>
                      </td>
                      <td className="px-5 py-4 font-mono">{model.accuracy}</td>
                      <td className="px-5 py-4 font-mono">{model.f1}</td>
                      <td className="px-5 py-4 font-mono">{model.precision}</td>
                      <td className="px-5 py-4 font-mono">{model.recall}</td>
                      <td className="px-5 py-4 font-mono">{model.mcc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {models.map((model, i) => (
              <Reveal key={model.name} delay={i * 0.06}>
                <div className="rounded-lg border border-edge bg-surface p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold">{model.name}</h3>
                    <span className={`font-mono text-xl ${model.name === "YOLOv8" ? "text-accent" : "text-foreground"}`}>{model.accuracy}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{model.note}</p>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-edge">
                    <div className={`h-full rounded-full ${model.name === "YOLOv8" ? "bg-accent" : "bg-foreground/50"}`} style={{ width: `${model.score}%` }} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted">
            Note: the abstract and Table II do not report the LSTM F1-score consistently. This page follows Table II for the comparison table. Metrics summarise the reported experiment and should not be interpreted as evidence of clinical readiness.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <SectionHeading
          eyebrow="Interpretation"
          title="Promising classification results are not a clinical validation"
          description="The work explores a potential route toward portable heart-sound analysis; it does not establish a clinically validated diagnostic tool."
        />
        <Reveal className="mt-10">
          <div className="rounded-lg border border-edge bg-surface p-6 sm:p-8">
            <ul className="space-y-4 text-sm leading-relaxed text-muted">
              <li><span className="font-medium text-foreground">Dataset.</span> The study uses the PhysioNet/CinC 2016 dataset, described in the paper as containing 3,240 recordings of varying duration.</li>
              <li><span className="font-medium text-foreground">Class imbalance.</span> The paper notes that abnormal heart sounds remain harder to identify reliably and suggests investigating imbalance-specific approaches.</li>
              <li><span className="font-medium text-foreground">Deployment remains future work.</span> The paper proposes exploring low-power microcontroller platforms; it does not demonstrate validated continuous monitoring on such hardware.</li>
              <li><span className="font-medium text-foreground">No medical advice.</span> This research demo is illustrative only and must not be used to assess a person's heart health.</li>
            </ul>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-edge">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-xs leading-relaxed text-muted">
            Publication: Verma, S. and Chadda, H., “Spectrogram-Driven Heart Sound Classification using YOLOv8 for Mobile Health Monitoring,” 2024 IEEE International Conference on Signal, Information and Data Processing (ICSIDP). DOI:{" "}
            <a className="underline underline-offset-4 hover:text-accent" href="https://doi.org/10.1109/ICSIDP62679.2024.10868008" target="_blank" rel="noreferrer">
              10.1109/ICSIDP62679.2024.10868008
            </a>. All animations on this page are illustrative; the trained research models are not executed here.
          </p>
        </div>
      </footer>
    </main>
  );
}
