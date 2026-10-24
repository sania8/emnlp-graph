import ConferenceHub from "@/components/stage/ConferenceHub";
import { getGraph } from "@/lib/graph";

export const instant = false;

export async function generateMetadata() {
  const g = await getGraph();
  return { title: `${g?.meta.conference ?? "Conference"} people graph` };
}

export default async function HomePage() {
  const g = await getGraph();
  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 py-10 sm:px-10">
      <ConferenceHub graph={g} />
    </main>
  );
}