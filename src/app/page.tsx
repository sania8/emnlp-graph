import Link from "next/link";
import GraphExplorer from "@/components/graph/GraphExplorer";
import { getGraph } from "@/lib/graph";
export const instant = false;
export async function generateMetadata() {
  const g = await getGraph();
  return { title: `${g?.meta.conference ?? "Conference"} people graph` };
}

export default async function HomePage() {
  const g = await getGraph();

  return (
      <main className="w-full px-3 py-6 sm:px-6 lg:py-8">
      <nav className="mb-8 flex flex-col items-center gap-5 border-b border-edge pb-8 text-center">
        <Link href="/" className="text-xl font-semibold tracking-tight hover:text-accent">
          Conference Compass
        </Link>

        <Link
          href="/portfolio"
          className="group inline-flex items-center gap-4 rounded-full border-2 border-accent bg-accent/10 px-14 py-6 text-3xl font-semibold text-accent shadow-lg transition-all duration-300 hover:scale-105 hover:bg-accent hover:text-white sm:text-4xl"
        >
          Explore My Portfolio
          <span className="text-4xl transition-transform duration-300 group-hover:translate-x-2 sm:text-5xl">
            →
          </span>
        </Link>
      </nav>

      {!g ? (
        <p className="mt-10 rounded-lg border border-edge p-6 text-sm">
          No dataset yet. Run <code>npm run kg</code>, then reload.
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-edge bg-surface p-6">
              <p className="text-4xl font-semibold tracking-tight xl:text-5xl">
                {g.meta.conference}
              </p>
              <p className="mt-3 text-xl text-accent xl:text-2xl">{g.meta.venue}</p>
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
            <a className="text-accent hover:underline" href="/data/conference.ttl">
              Download RDF (Turtle)
            </a>
          </p>
        </>
      )}
    </main>
  );
}