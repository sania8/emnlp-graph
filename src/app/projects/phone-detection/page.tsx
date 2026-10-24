import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DetectionSim } from "@/components/phone/DetectionSim";
import { Reveal, SectionHeading } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Mobile Phone Usage Detection",
  description:
    "Combining a fine-tuned YOLOv7 detector with MediaPipe hand tracking and a spatial decision rule to tell phone usage apart from a phone simply being present.",
};

const stats = [
  { value: "YOLOv7 · MediaPipe", label: "Detector + hand tracking" },
  { value: "0.60", label: "Decision threshold" },
  { value: "~75% → ~90%", label: "Reported detection accuracy" },
];

const whyItWorks = [
  {
    title: "A box is not an action",
    body: "Object detection answers “is there a phone in frame?”. The actual question is “is someone using one?”. A phone resting on a counter satisfies the detector and should not raise an alert.",
  },
  {
    title: "Two weak signals beat one",
    body: "The detector localises the phone; MediaPipe localises the hand as an articulated skeleton. Either alone is ambiguous, but their geometric relationship is far more specific than either output on its own.",
  },
  {
    title: "The threshold is the product decision",
    body: "Everything upstream produces a continuous score. Setting it at 0.60 is what turns measurement into an alert, and it is the dial that trades missed events against false alarms.",
  },
];

export default function PhoneDetectionPage() {
  return (
    <main>
      {/* ---------------- Hero ---------------- */}
      <header className="relative overflow-hidden border-b border-edge">
        <div className="absolute inset-0">
          <Image
            src="/projects/phone-detection/poster.webp"
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-12 saturate-50"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/92 to-background" />
          <div className="absolute inset-0 bg-grid opacity-40" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.25em] text-muted transition-colors hover:text-accent"
          >
            ← Portfolio
          </Link>

          <p className="mt-10 font-mono text-xs uppercase tracking-[0.25em] text-accent">
            Computer vision · Behaviour detection
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Telling phone <span className="text-accent">usage</span> apart from
            a phone simply being there.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            A pre-trained detector could find phones but fired constantly on
            things that were not phones, and could not tell whether one was
            being used. Fine-tuning the detector, adding MediaPipe hand
            tracking, and reducing the hand–phone geometry to a thresholded
            decision turned a noisy detector into a usable alert.
          </p>

          <dl className="mt-12 grid gap-6 sm:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-edge bg-surface p-5 backdrop-blur-sm"
              >
                <dt className="text-xs uppercase tracking-wider text-muted">
                  {s.label}
                </dt>
                <dd className="mt-2 font-mono text-lg text-foreground">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* ---------------- Simulation ---------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <SectionHeading
          eyebrow="Interactive walkthrough"
          title="Watch the decision get built up"
          description="Each stage adds one signal to the same frame: loose baseline boxes, then a fine-tuned detector, then hand landmarks, then the geometry between them, and finally the threshold that turns it into an alert."
        />
        <Reveal className="mt-10">
          <DetectionSim />
        </Reveal>
      </section>

      {/* ---------------- Real output ---------------- */}
      <section className="border-y border-edge bg-tint">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <SectionHeading
            eyebrow="Recorded output"
            title="The system running on real footage"
            description="Detector output recorded from the working system on surveillance video, with live bounding boxes. This clip is a genuine capture, not a reconstruction."
          />
          <Reveal className="mt-10">
            <figure>
              <div className="overflow-hidden rounded-xl border border-edge bg-surface">
                <video
                  className="h-auto w-full"
                  src="/projects/phone-detection/detection-output.mp4"
                  poster="/projects/phone-detection/poster.webp"
                  controls
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
              </div>
              <figcaption className="mt-3 text-xs leading-relaxed text-muted">
                Genuine recorded output from the project. Converted from the
                original screen capture for web delivery; no frames were
                altered beyond cropping the recording bars and re-encoding.
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Reasoning ---------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <SectionHeading
          eyebrow="Design reasoning"
          title="Why the extra stages were necessary"
          description="The jump in reliability did not come from a bigger model. It came from asking a better-posed question of the frame."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {whyItWorks.map((w, i) => (
            <Reveal key={w.title} delay={i * 0.08}>
              <div className="h-full rounded-lg border border-edge bg-surface p-6 transition-colors hover:border-accent/30">
                <h3 className="text-lg font-semibold tracking-tight">
                  {w.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {w.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10">
          <p className="rounded-lg border border-edge bg-surface-raised p-5 text-xs leading-relaxed text-muted">
            <span className="font-mono uppercase tracking-wider text-accent/80">
              On numbers ·
            </span>{" "}
            The ~75% and ~90% accuracy figures are as reported for this project.
            No evaluation dataset, split, or per-class breakdown is published
            here, so they should be read as the project&rsquo;s own summary
            rather than a benchmarked result.
          </p>
        </Reveal>
      </section>

      <footer className="border-t border-edge">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-xs leading-relaxed text-muted">
            The walkthrough above is an original schematic animation built to
            explain the pipeline. The video is genuine recorded output. No model
            runs in your browser.
          </p>
        </div>
      </footer>
    </main>
  );
}
