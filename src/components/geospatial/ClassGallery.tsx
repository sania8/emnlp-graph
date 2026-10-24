"use client";

import Image from "next/image";
import { useState } from "react";
import type { FeatureClass } from "@/lib/geospatial";

/**
 * Genuine per-class inference panels exported from the project run. Each sample
 * is shown as the input tile plus a switchable ground-truth / prediction
 * overlay, so the two can be compared without any derived score being implied.
 */
export function ClassGallery({ classes }: { classes: FeatureClass[] }) {
  const [active, setActive] = useState(classes[0]?.slug ?? "");
  const [overlay, setOverlay] = useState<"ground-truth" | "prediction">(
    "prediction",
  );

  const current = classes.find((c) => c.slug === active) ?? classes[0];
  if (!current) return null;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Feature classes"
        className="flex flex-wrap gap-2"
      >
        {classes.map((c) => (
          <button
            key={c.slug}
            role="tab"
            type="button"
            aria-selected={c.slug === current.slug}
            onClick={() => setActive(c.slug)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              c.slug === current.slug
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-edge text-muted hover:border-accent/30 hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {current.samples.length} exported sample
          {current.samples.length === 1 ? "" : "s"} for{" "}
          <span className="text-foreground">{current.label.toLowerCase()}</span>
        </p>
        <div className="inline-flex rounded-md border border-edge p-0.5">
          {(
            [
              ["ground-truth", "Ground truth"],
              ["prediction", "Prediction"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setOverlay(key)}
              aria-pressed={overlay === key}
              className={`rounded px-3 py-1.5 font-mono text-[1.02rem] uppercase tracking-wider transition-colors ${
                overlay === key
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {current.samples.map((s, i) => (
          <figure
            key={s.source}
            className="group overflow-hidden rounded-lg border border-edge bg-surface"
          >
            <div className="grid grid-cols-2">
              <div className="relative aspect-square border-r border-edge">
                <Image
                  src={s.image}
                  alt={`Input tile ${i + 1} for ${current.label.toLowerCase()}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-surface px-1.5 py-0.5 font-mono text-[0.98rem] uppercase tracking-wider text-foreground">
                  Tile
                </span>
              </div>
              <div className="relative aspect-square">
                <Image
                  src={s[overlay]}
                  alt={`${overlay === "prediction" ? "Model prediction" : "Ground truth"} for ${current.label.toLowerCase()} tile ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-surface px-1.5 py-0.5 font-mono text-[0.98rem] uppercase tracking-wider text-accent">
                  {overlay === "prediction" ? "Prediction" : "Ground truth"}
                </span>
              </div>
            </div>
            <figcaption className="border-t border-edge px-3 py-2 font-mono text-[0.96rem] text-muted">
              {s.source}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
