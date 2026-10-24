// Visual language for the conference graph.
// Colour says what a node is, shape says it again (so it works without colour),
// size says how connected it is.

export type NodeType = "Person" | "Talk" | "Session" | "Institution" | "Topic";
export type Mode = "dark" | "light";

type Palette = {
  types: Record<NodeType, string>;
  bg: string; // canvas background colour
  grid: string; // canvas background pattern
  ink: string; // label text
  muted: string; // links and fallback node colour
  surface: string; // should match bg: used for node outlines and label backing
  accent: string; // highlighted links
};

// Edit colours here. Dark: bright, saturated colours that glow on a near-black canvas.
// Light: deeper versions of the same hues so they stay readable on a pale canvas.
export const PALETTES: Record<Mode, Palette> = {
  dark: {
    types: {
      Person: "#4cc9f0",
      Talk: "#ffb703",
      Session: "#c77dff",
      Institution: "#52f2a0",
      Topic: "#ff6b9a",
    },
    bg: "#05070f",
    grid:
      "radial-gradient(circle at 50% 42%, rgb(90 130 255 / 0.14), transparent 62%), radial-gradient(rgb(160 180 255 / 0.16) 1px, transparent 1px)",
    ink: "#e8edff",
    muted: "#8ea2c9",
    surface: "#05070f", // keep identical to bg
    accent: "#9be7ff",
  },
  light: {
    types: {
      Person: "#1d6fd6",
      Talk: "#d9730d",
      Session: "#7c3aed",
      Institution: "#0f9d6b",
      Topic: "#d6336c",
    },
    bg: "#ffffff",
    grid:
      "radial-gradient(rgb(40 60 120 / 0.10) 1px, transparent 1px)",
    ink: "#14192b",
    muted: "#6b7694",
    surface: "#f6f7fb", // keep identical to bg
    accent: "#1d4ed8",
  },
};

// Default (dark) colours, kept for components that import COLORS.
export const COLORS = PALETTES.dark.types;

const SHAPES: Record<NodeType, string> = {
  Person: "ellipse",
  Talk: "round-rectangle",
  Session: "round-hexagon",
  Institution: "round-pentagon",
  Topic: "round-diamond",
};

// Colours are read from your Tailwind theme at runtime and passed in.
export type Theme = { accent: string; muted: string; ink: string; surface: string; types?: Record<NodeType, string> };

// Classes the explorer toggles: hidden, off, faded, hl (highlighted neighbourhood), sel (selected node)
export function buildStyle(t: Theme, maxDeg: number): any[] {
  const md = Math.max(maxDeg, 2);
  const size = `mapData(deg, 1, ${md}, 14, 64)`; // smallest node, biggest node

  const types = t.types ?? COLORS;
  const perType = (Object.keys(types) as NodeType[]).map((k) => ({
    selector: `node[type = "${k}"]`,
    style: {
      "background-color": types[k],
      "underlay-color": types[k],
      shape: SHAPES[k],
    },
  }));

  return [
    {
      selector: "node",
      style: {
        width: size,
        height: size,
        "background-color": t.muted,
        "border-width": 1.5,
        "border-color": t.surface,
        "underlay-color": t.muted,
        "underlay-opacity": 0.14,
        "underlay-padding": 5,
        label: "data(label)",
        color: t.ink,
        "font-family": "ui-sans-serif, system-ui, sans-serif",
        // Bigger hubs get bigger labels, and labels below the zoom threshold are
        // hidden, so zooming out shows only hubs and zooming in reveals the rest.
        "font-size": `mapData(deg, 1, ${md}, 16, 34)`,
        "min-zoomed-font-size": 15,
        "text-valign": "bottom",
        "text-margin-y": 5,
        "text-wrap": "ellipsis",
        "text-max-width": 110,
        "text-background-color": t.surface,
        "text-background-opacity": 0.8,
        "text-background-padding": 2,
        "text-background-shape": "roundrectangle",
        "transition-property": "opacity, underlay-opacity, underlay-padding",
        "transition-duration": "0.2s",
      },
    },
    ...perType,
    {
      selector: "edge",
      style: {
        width: 1,
        "line-color": t.muted,
        opacity: 0.3,
        "curve-style": "bezier",
        "control-point-step-size": 24,
        "line-cap": "round",
        "transition-property": "opacity, line-color, width",
        "transition-duration": "0.2s",
      },
    },
    { selector: ".hidden, .off", style: { display: "none" } },
    { selector: "node.faded", style: { opacity: 0.1, "text-opacity": 0 } },
    { selector: "edge.faded", style: { opacity: 0.03 } },
    {
      selector: "node.hl",
      style: {
        "underlay-opacity": 0.32,
        "underlay-padding": 9,
        "min-zoomed-font-size": 0,
        "font-size": 18,
        "text-opacity": 1,
        "z-index-compare": "manual",
        "z-index": 500,
      },
    },
    {
      selector: "edge.hl",
      style: {
        width: 1.8,
        "line-color": t.accent,
        opacity: 0.95,
        // dashed + animated offset (see GraphExplorer) gives the "flow" along links
        "line-style": "dashed",
        "line-dash-pattern": [10, 6],
        "z-index-compare": "manual",
        "z-index": 400,
      },
    },
    {
      selector: "node.sel",
      style: {
        "border-width": 3,
        "border-color": t.ink,
        "underlay-opacity": 0.4,
        "underlay-padding": 13,
        "font-size": 22,
        "font-weight": 700,
        "min-zoomed-font-size": 0,
        "text-opacity": 1,
        "z-index-compare": "manual",
        "z-index": 999,
      },
    },
  ];
}

// Backwards-compatible export for components that still import STYLE (e.g. HeroGraph).
// Uses a fixed dark palette; GraphExplorer builds its own theme-aware style with buildStyle().
export const STYLE = buildStyle(
  {
    accent: "rgb(132, 229, 190)",
    muted: "rgb(154, 185, 216)",
    ink: "rgb(230,230,230)",
    surface: "rgb(20,20,24)",
  },
  12
);