const topics = [
  {
    q: "Why tile the raster at all?",
    a: "A segmentation network accepts a fixed, comparatively small input size. A full drone survey raster is orders of magnitude larger, so it is cut into a grid of smaller patches. Each patch is processed independently, which also means inference can be parallelised and memory use stays bounded regardless of how large the source scene is.",
  },
  {
    q: "What happens at tile boundaries?",
    a: "Tiles are processed in isolation, so a feature crossing a tile edge is seen only partially by the model on either side. This is the main source of seam artefacts when the masks are placed back together, and it is why the reassembly step — not just the inference step — matters for the quality of the final map.",
  },
  {
    q: "How is the full map reconstructed?",
    a: "Each tile keeps a record of where it came from in the source raster. After inference, the per-tile masks are written back into those positions to rebuild a single prediction surface covering the whole scene, which can then be exported as a georeferenced raster rather than a folder of disconnected patches.",
  },
  {
    q: "Why both U-Net and DeepLabV3?",
    a: "The two architectures were fine-tuned and evaluated for this task rather than one being assumed best. U-Net's encoder–decoder with skip connections preserves fine spatial detail, which suits thin linear features. DeepLabV3 uses atrous (dilated) convolutions to widen the receptive field without losing resolution, which helps where more surrounding context is needed to identify a feature.",
  },
];

const models = [
  {
    name: "U-Net",
    tagline: "Encoder–decoder with skip connections",
    points: [
      "Symmetric contracting and expanding paths",
      "Skip connections carry high-resolution detail across the bottleneck",
      "Well suited to narrow, detail-sensitive structures",
    ],
  },
  {
    name: "DeepLabV3",
    tagline: "Atrous convolution with multi-scale context",
    points: [
      "Dilated convolutions enlarge the receptive field at constant resolution",
      "Atrous spatial pyramid pooling aggregates several context scales",
      "Helps where a feature is only identifiable from its surroundings",
    ],
  },
];

export function TechDetails() {
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
          How the pipeline works
        </h3>
        <div className="mt-5 divide-y divide-[var(--border)] border-y border-edge">
          {topics.map((t) => (
            <details key={t.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-medium text-foreground transition-colors hover:text-accent">
                {t.q}
                <span
                  aria-hidden
                  className="shrink-0 font-mono text-accent transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted">{t.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
          Architectures compared
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {models.map((m) => (
            <div
              key={m.name}
              className="rounded-lg border border-edge bg-surface p-5 transition-colors hover:border-accent/30"
            >
              <h4 className="text-lg font-semibold tracking-tight">{m.name}</h4>
              <p className="mt-1 text-xs text-accent">{m.tagline}</p>
              <ul className="mt-4 space-y-2.5">
                {m.points.map((p) => (
                  <li
                    key={p}
                    className="flex gap-2.5 text-sm leading-relaxed text-muted"
                  >
                    <span aria-hidden className="mt-1.5 text-accent/60">
                      ▸
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-5 rounded-lg border border-edge bg-surface-raised p-4 text-xs leading-relaxed text-muted">
          <span className="font-mono uppercase tracking-wider text-accent/80">
            On numbers ·
          </span>{" "}
          No accuracy, IoU or F1 figures are published here. The comparison above
          describes architectural differences only; quantitative results will be
          added when the corresponding evaluation outputs are attached to this
          case study.
        </p>
      </div>
    </div>
  );
}
