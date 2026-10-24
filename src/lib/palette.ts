/**
 * Colours used inside the SVG diagrams.
 *
 * SVG attributes cannot read Tailwind classes, so these are defined here.
 *
 * IMPORTANT: every diagram is rendered inside a card, and cards use the dark
 * plum surface. These values are therefore the *dark context* colours and must
 * stay in step with the `[class*="bg-surface"]` block in `globals.css`.
 */
export const palette = {
  /** Primary accent on a dark card. */
  accent: "#ff7ab8",
  /** Lighter accent for fills and secondary strokes. */
  accentSoft: "#ffa8d2",
  /** Secondary highlight for a second data series. */
  warn: "#ffc46b",
  /** Negative / removed state. */
  danger: "#ff8585",
  /** Structural hairlines and outlines. */
  dim: "#5d4a7d",
  /** Very faint tone for dense fully-connected meshes. */
  mesh: "#3d2f56",
  /** Secondary text inside diagrams. */
  soft: "#b9a4c6",
  /** Primary text inside diagrams. */
  text: "#f7ecf5",
  /** Node and card fills sitting on the canvas. */
  panel: "#2f2446",
  /** Diagram canvas background, a shade below the card. */
  canvas: "#1c1428",
  /** Slightly raised fill for secondary shapes. */
  raised: "#3a2c54",
} as const;
