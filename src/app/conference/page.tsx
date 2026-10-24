import GraphExplorer from "@/components/graph/GraphExplorer";
import { getGraph } from "@/lib/graph";

export async function generateMetadata() {
  const g = await getGraph();
  return { title: `${g?.meta.conference ?? "Conference"} people graph` };
}

export default async function ConferencePage() {
  const g = await getGraph();

  return (
    <main className="w-full px-3 py-6 sm:px-6 lg:py-8">
      {!g ? (
        <p className="rounded-lg border border-edge p-6 text-sm">
          No dataset yet. Run <code>npm run kg</code>, then reload.
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-edge bg-surface p-6">
              <p className="text-4xl font-semibold tracking-tight xl:text-5xl">
                {g.meta.conference}
              </p>
              <p className="mt-3 text-xl text-accent xl:text-2xl">
                {g.meta.venue}
              </p>
              <p className="text-lg text-muted xl:text-xl">{g.meta.dates}</p>
            </div>

            <div className="rounded-xl border border-edge bg-surface p-6">
              <p className="text-6xl font-semibold tabular-nums xl:text-7xl">
                {g.meta.counts.people}
              </p>
              <p className="mt-2 text-2xl text-muted">People</p>
            </div>

            <div className="rounded-xl border border-edge bg-surface p-6">
              <p className="text-6xl font-semibold tabular-nums xl:text-7xl">
                {g.meta.counts.talks}
              </p>
              <p className="mt-2 text-2xl text-muted">Talks</p>
            </div>
          </div>

          <GraphExplorer graph={g} />

          <p className="mt-4 text-base text-muted">
            Copy the address bar to share any selection.{" "}
            <a className="text-accent hover:underline" href="/data/conference.ttl">
              Download RDF (Turtle)
            </a>
          </p>
        </>
      )}
    </main>
  );
}