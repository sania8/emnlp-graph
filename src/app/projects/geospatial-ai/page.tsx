  import type { Metadata } from "next";
  import Image from "next/image";
  import { ClassGallery } from "@/components/geospatial/ClassGallery";
  import { CompareSlider } from "@/components/geospatial/CompareSlider";
  import { Hero } from "@/components/geospatial/Hero";
  import { PipelineDemo } from "@/components/geospatial/PipelineDemo";
  import { TechDetails } from "@/components/geospatial/TechDetails";
  import { Reveal, SectionHeading } from "@/components/ui/Reveal";
  import {
    comparePair,
    demoScene,
    featureClasses,
    stitched,
  } from "@/lib/geospatial";

  export const metadata: Metadata = {
    title: "Geospatial AI — Large-Scale Semantic Segmentation",
    description:
      "Splitting a large drone GeoTIFF into tiles, running fine-tuned U-Net and DeepLabV3 segmentation models over each tile, and stitching the predictions back into one continuous map.",
  };

  export default function GeospatialAIPage() {
    return (
      <main>
        <Hero />

        {/* Pipeline demonstration */}
        <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <SectionHeading
            eyebrow="Interactive walkthrough"
            title="Follow the raster through the pipeline"
            description="The scene splits into tiles, each tile subdivides into model-input patches, the masks come back patch by patch, and everything pulls together again into one map. Imagery is loaded from precomputed project exports — nothing is computed in your browser."
          />
          {demoScene ? (
            <Reveal className="mt-10">
              <PipelineDemo
                classes={featureClasses}
                raster={demoScene.raster}
                prediction={demoScene.prediction}
                predictionMask={demoScene.predictionMask}
                sceneLabel={demoScene.label}
                sceneSource={demoScene.source}
                sceneColour={demoScene.colour}
              />
            </Reveal>
          ) : null}
        </section>

        {/* Before / after */}
        {comparePair ? (
          <section className="border-y border-edge bg-tint">
            <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
              <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-center">
                <div>
                  <SectionHeading
                    eyebrow="Before / after"
                    title="Drag to reveal the prediction"
                    description="On the left, the raw drone tile as the model receives it. On the right, the segmentation mask the fine-tuned model produced for that same tile."
                  />
                  <p className="mt-6 text-sm leading-relaxed text-muted">
                    Both frames come from the same exported sample, so the
                    alignment you see is the model&rsquo;s actual spatial
                    agreement with the imagery — not a re-registered or
                    touched-up overlay.
                  </p>
                </div>
                <Reveal>
                  <CompareSlider
                    before={comparePair.before}
                    after={comparePair.after}
                    beforeLabel="Input tile"
                    afterLabel="Prediction"
                    caption={`Genuine project output · ${comparePair.label} · ${comparePair.source}`}
                  />
                </Reveal>
              </div>
            </div>
          </section>
        ) : null}

        {/* Class gallery */}
        <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <SectionHeading
            eyebrow="Model outputs"
            title="Segmented feature classes"
            description="Separate segmentation targets were addressed across the survey area. Each card pairs the input tile with either the annotated ground truth or the model prediction so the two can be read side by side."
          />
          <Reveal className="mt-10">
            <ClassGallery classes={featureClasses} />
          </Reveal>
        </section>

        {/* Stitched result */}
        {stitched ? (
          <section className="border-y border-edge bg-tint">
            <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
              <SectionHeading
                eyebrow="Reconstructed output"
                title="One continuous classified scene"
                description="After every tile has been processed, the masks are written back into their source positions. The result is a single scene-wide map rather than a collection of isolated patches."
              />
              <Reveal className="mt-10">
                <figure>
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-edge sm:aspect-[16/10]">
                    <Image
                      src={stitched.src}
                      alt="Full-scene segmentation map reconstructed from per-tile predictions"
                      fill
                      sizes="(max-width: 1024px) 100vw, 1100px"
                      className="object-cover"
                    />
                  </div>
                  <figcaption className="mt-3 font-mono text-[1.02rem] text-muted">
                    Genuine project export · {stitched.source} ·{" "}
                    {stitched.width}×{stitched.height} px source
                  </figcaption>
                </figure>
              </Reveal>
            </div>
          </section>
        ) : null}

        {/* Technical detail */}
        <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <SectionHeading
            eyebrow="Technical detail"
            title="The parts that are easy to get wrong"
            description="Tiling a raster is straightforward. Keeping the predictions coherent once they are put back together is the harder half of the problem."
          />
          <Reveal className="mt-12">
            <TechDetails />
          </Reveal>
        </section>

        <footer className="border-t border-edge">
          <div className="mx-auto max-w-7xl px-6 py-10">
            <p className="text-xs leading-relaxed text-muted">
              All imagery on this page is derived from genuine project exports.
              The tiling and stitching animations are browser-side visual
              reconstructions of those pipeline steps; no inference is performed
              in the page and no performance metrics are claimed.
            </p>
          </div>
        </footer>
      </main>
    );
  }
