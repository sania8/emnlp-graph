"use client";

import { useState } from "react";

type Figure = {
  number: string;
  title: string;
  description: string;
  src: string;
  alt: string;
  aspect?: string;
};

const figures: Figure[] = [
  {
    number: "FIG. 01",
    title: "Motion-defined stimuli",
    description:
      "Use a representative kinematogram or stimulus frame from the paper so visitors can see what the model was asked to interpret.",
    src: "/images/unfinished-race/kinematogram-stimulus.png",
    alt: "Representative object kinematogram stimulus from the paper",
    aspect: "aspect-[4/3]",
  },
  {
    number: "FIG. 02",
    title: "The processing pipeline",
    description:
      "A crop of the paper's method figure works best here: motion estimation, preprocessing, frame selection, then YOLOv9 classification.",
    src: "/images/unfinished-race/pipeline-overview.png",
    alt: "Method overview of the motion-focused classification pipeline",
    aspect: "aspect-[16/10]",
  },
  {
    number: "FIG. 03",
    title: "Reported results",
    description:
      "Add the paper's results table or chart if it is legible at this size. The interactive results below remain available as accessible HTML.",
    src: "/images/unfinished-race/results-comparison.png",
    alt: "Reported model and preprocessing results from the paper",
    aspect: "aspect-[4/3]",
  },
];

function FigureCard({ figure }: { figure: Figure }) {
  const [loaded, setLoaded] = useState(true);

  return (
    <figure className="group overflow-hidden rounded-xl border border-edge bg-surface transition-colors hover:border-accent/40">
      <div className={`relative ${figure.aspect ?? "aspect-[4/3]"} overflow-hidden border-b border-edge bg-[#080d16]`}>
        {loaded ? (
          <img
            src={figure.src}
            alt={figure.alt}
            loading="lazy"
            onError={() => setLoaded(false)}
            className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center">
            <span className="font-mono text-[10px] tracking-[0.22em] text-cyan-300">{figure.number} · IMAGE SLOT</span>
            <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 text-2xl text-slate-400">＋</div>
            <p className="mt-3 text-sm font-medium text-slate-200">Add your figure here</p>
            <p className="mt-1 max-w-xs break-words font-mono text-[10px] leading-relaxed text-slate-400">public{figure.src}</p>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded border border-slate-700/80 bg-slate-950/80 px-2 py-1 font-mono text-[9px] tracking-[0.18em] text-slate-300">{figure.number}</span>
      </div>
      <figcaption className="p-5">
        <h3 className="text-base font-semibold tracking-tight">{figure.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{figure.description}</p>
      </figcaption>
    </figure>
  );
}

export function PaperFigures() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-20 sm:pb-24" aria-labelledby="paper-figures-title">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">From the paper</p>
          <h2 id="paper-figures-title" className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">The experiment, at a glance</h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-muted">These figure slots are ready for your original paper visuals. Until you add the files, they show clear placeholders instead of broken-image icons.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {figures.map((figure) => <FigureCard key={figure.src} figure={figure} />)}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">Use figures you have permission to reproduce. If you crop them from the published paper, keep the figure number/caption or add a brief source note beneath the image.</p>
    </section>
  );
}
