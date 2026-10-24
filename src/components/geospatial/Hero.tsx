import Image from "next/image";
import Link from "next/link";
import { featureClasses, stitched } from "@/lib/geospatial";

const stats = [
  { value: `${featureClasses.length}`, label: "Feature classes segmented" },
  { value: "U-Net · DeepLabV3", label: "Fine-tuned architectures" },
  { value: "GeoTIFF → tiles → GeoTIFF", label: "End-to-end raster workflow" },
];

export function Hero() {
  return (
    <header className="relative overflow-hidden border-b border-edge">
      {stitched ? (
        <div className="absolute inset-0">
          <Image
            src={stitched.src}
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-15 saturate-50"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
          <div className="absolute inset-0 bg-grid opacity-40" />
        </div>
      ) : null}

      <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.25em] text-muted transition-colors hover:text-accent"
        >
          ← Portfolio
        </Link>

        <p className="mt-10 font-mono text-xs uppercase tracking-[0.25em] text-accent">
          Geospatial AI · Semantic segmentation at scale
        </p>

        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
          Turning one enormous aerial raster into a{" "}
          <span className="text-accent">map a machine can read</span>.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          A single drone-captured GeoTIFF is far too large to feed into a
          segmentation network. This project splits the raster into manageable
          tiles, runs fine-tuned U-Net and DeepLabV3 models over each tile, and
          stitches the per-tile masks back into one continuous, georeferenced
          prediction map.
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
              <dd className="mt-2 font-mono text-lg text-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
