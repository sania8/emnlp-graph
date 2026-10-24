import { WorkGraph, type GraphWork } from "@/components/home/WorkGraph";
import ProjectGroups, { type Group, type GroupItem } from "@/components/home/ProjectGroups";
import { featureClasses } from "@/lib/geospatial";

const cards: GroupItem[] = [
  {
    href: "/research/financial-sentiment-xai",
    kind: "Research",
    venue: "NLDB 2026 · Springer LNCS",
    title: "When Words Move Markets",
    short: "Financial sentiment",
    line: "Which tokens does a financial sentiment prediction rest on? Opening up three fine-tuned LLMs.",
  },
  {
    href: "/research/glow-powerline",
    kind: "Research",
    venue: "GLOW @ ISWC'26 · Bari",
    title: "Graph-Grounded Power-Line Agent",
    short: "Power-line agent",
    line: "Every maintenance work order traceable from image to action.",
  },
  {
    href: "/research/Unfinished-race",
    kind: "Research",
    venue: "MBCC 2025 · Springer",
    title: "The Unfinished Race",
    short: "Unfinished Race",
    line: "A two-stage vision pipeline for motion-defined kinematograms: 47.22% accuracy.",
  },
  {
    href: "/research/Spectrogram-driven",
    kind: "Research",
    venue: "IEEE ICSIDP 2024",
    title: "Heart Sound Classification",
    short: "Heart sounds",
    line: "YOLOv8 on spectrograms for mobile health monitoring: 94.5% accuracy.",
  },
  {
    href: "/academic/msc-thesis",
    kind: "Thesis",
    venue: "MSc AI · City St George's, University of London",
    title: "Agentic RAG for Multilingual AMR Policy",
    short: "MSc thesis",
    line: "Extracting antimicrobial resistance policy information across languages, with the Fleming Initiative.",
  },
  {
    href: "/projects/geospatial-ai",
    kind: "Applied",
    venue: `Geospatial AI · ${featureClasses.length} classes`,
    title: "Large-Scale Segmentation",
    short: "Segmentation",
    line: "Tile, segment and stitch one continuous drone map.",
    thumbnail: "/projects/geospatial-ai/thumbnail.webp",
  },
  {
    href: "/projects/phone-detection",
    kind: "Applied",
    venue: "Computer vision",
    title: "Phone Usage Detection",
    short: "Phone detection",
    line: "Reports phone use, not just phone presence.",
    thumbnail: "/projects/phone-detection/thumbnail.webp",
  },
];

const research = cards.slice(0, 4);
const thesis = cards[4];
const projects = cards.slice(5);

const groups: Group[] = [
  {
    id: "research",
    title: "Research & collaborative projects",
    sub: "Peer-reviewed papers",
    accent: "sky",
    items: research,
  },
  {
    id: "graymatics",
    title: "AI Algorithm Engineer Intern at Graymatics Pvt. Ltd.",
    sub: "Singapore · Remote",
    accent: "emerald",
    items: projects,
  },
  {
    id: "academic",
    title: "Academic projects",
    sub: "MSc Artificial Intelligence",
    accent: "fuchsia",
    items: [thesis],
  },
];

// Nodes for the interactive graph. Works that share a theme are linked through it.
const graphWorks: GraphWork[] = [
  { id: "fin", href: research[0].href, label: "Financial sentiment", title: research[0].title, themes: ["LLMs & language", "Trustworthy AI"] },
  { id: "glow", href: research[1].href, label: "Power-line agent", title: research[1].title, themes: ["Computer vision", "Agents & knowledge", "Trustworthy AI"] },
  { id: "race", href: research[2].href, label: "Unfinished Race", title: research[2].title, themes: ["Computer vision"] },
  { id: "heart", href: research[3].href, label: "Heart sounds", title: research[3].title, themes: ["Computer vision", "Health & signals"] },
  { id: "thesis", href: thesis.href, label: "MSc thesis", title: thesis.title, themes: ["LLMs & language", "Agents & knowledge", "Health & signals"] },
  { id: "geo", href: projects[0].href, label: "Segmentation", title: projects[0].title, themes: ["Computer vision", "Deployed systems"] },
  { id: "phone", href: projects[1].href, label: "Phone detection", title: projects[1].title, themes: ["Computer vision", "Deployed systems"] },
];

export default function Home() {
  return (
    <main className="w-full px-4 py-6 sm:px-8">
      {/* hide the page scrollbar on this page only */}
      <style>{`html{scrollbar-width:none}html::-webkit-scrollbar{display:none}`}</style>

      <div className="grid gap-6 lg:h-[calc(100vh-8rem)] lg:min-h-[640px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* left: headline + simulation */}
        <div className="flex min-h-0 flex-col gap-5">
          <header>
            <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight xl:text-5xl 2xl:text-6xl">
              AI engineering,
              <br />
              <span className="text-accent">shown, not listed.</span>
            </h1>
          </header>
          <section
            aria-label="How the work connects"
            className="h-[560px] min-h-0 flex-1 lg:h-auto"
          >
            <WorkGraph works={graphWorks} />
          </section>
        </div>

        {/* right: three clickable groups */}
        <div className="min-h-0">
          <ProjectGroups groups={groups} />
        </div>
      </div>
    </main>
  );
}