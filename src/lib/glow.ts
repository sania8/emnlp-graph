/**
 * Facts for the GLOW@ISWC'26 power-line O&M paper.
 *
 * Every value here is taken directly from the paper
 * "Graph-Grounded Multimodal Agent for Trustworthy Power-Line Operations and
 * Maintenance" (Verma et al.). Nothing is estimated or extrapolated — if a
 * number is not in the paper it does not appear on the site.
 */

export const paper = {
  title:
    "Graph-Grounded Multimodal Agent for Trustworthy Power-Line Operations and Maintenance",
  venue: "GLOW@ISWC'26 — 2nd Workshop on Graph-enhanced LLMs for Trustworthy Web Data Management",
  location: "Bari, Italy · 25–26 October 2026",
  role: "First author",
  authors:
    "Sania Verma, Joyjit Chatterjee, Jing Guo, Akash Marar, Rajendra Shankaran, Garima Sharma, Zekun Guo, Anu Mehra",
  affiliations:
    "City, St George's University of London · EPAM Systems · Loughborough University · Takit Inc. · Reckitt Global Technology Hub · MathWorks · University of Hull · Amity University",
} as const;

/** Reported evaluation results. */
export const results = [
  {
    value: "0.83",
    label: "YOLO F1",
    note: "component + defect presence, 51-sample held-out validation set",
  },
  {
    value: "0.86 / 0.79",
    label: "YOLO precision / recall",
    note: "same validation split",
  },
  {
    value: "0.75",
    label: "VLM defect-type accuracy",
    note: "many-shot in-context learning, no parameter updates",
  },
  {
    value: "0.65",
    label: "Description similarity",
    note: "cosine similarity against expert descriptions",
  },
  {
    value: "0.88",
    label: "KG-supported faithfulness",
    note: "human evaluation of 11 generated work orders",
  },
] as const;

/** Corpus composition ingested into the knowledge graph. */
export const corpus = [
  { label: "Images total", value: "49,706" },
  { label: "Detection subset", value: "10,561" },
  { label: "Defect-supervised subset", value: "11,525" },
  { label: "Anomaly-detection subset", value: "27,620" },
  { label: "COCO annotations", value: "28,959" },
  { label: "Curated VLM observations", value: "255" },
  { label: "Stockbridge SimulationRuns", value: "80" },
] as const;

/** Ontology scale, as stated in the paper. */
export const ontology = [
  { label: "Component types", value: "18" },
  { label: "Visual defect types", value: "5" },
  { label: "Severity levels", value: "4 (0–3, ordinal)" },
  { label: "Failure modes", value: "8" },
  { label: "Operational risks", value: "6" },
  { label: "Environmental contexts", value: "3" },
  { label: "Standards", value: "7" },
  { label: "Maintenance actions", value: "8" },
  { label: "Work-order templates", value: "3" },
] as const;

export type Severity = "minor" | "moderate" | "severe";

/**
 * The deterministic severity floor from the Bound step.
 *
 * floor = max(severity from VLM, band(simulation risk score)),
 * escalated one level if damping health index < 0.15, capped at severe.
 * Bands: < 0.35 minor · 0.35–0.60 moderate · >= 0.60 severe.
 */
export const SEVERITY_ORDER: Severity[] = ["minor", "moderate", "severe"];

export function bandRiskScore(risk: number): Severity {
  if (risk < 0.35) return "minor";
  if (risk < 0.6) return "moderate";
  return "severe";
}

export function severityFloor(
  vlmSeverity: Severity,
  riskScore: number,
  dampingHealth: number,
): { floor: Severity; escalated: boolean; banded: Severity } {
  const banded = bandRiskScore(riskScore);
  let index = Math.max(
    SEVERITY_ORDER.indexOf(vlmSeverity),
    SEVERITY_ORDER.indexOf(banded),
  );
  const escalated = dampingHealth < 0.15;
  if (escalated) index = Math.min(index + 1, SEVERITY_ORDER.length - 1);
  return { floor: SEVERITY_ORDER[index], escalated, banded };
}

/**
 * Severity-conditioned actions for corrosion, as described in the paper:
 * "corrosion resolves to visual monitoring, hardware replacement, or
 * emergency intervention according to severity".
 */
export const CORROSION_ACTION: Record<Severity, string> = {
  minor: "Visual monitoring",
  moderate: "Hardware replacement",
  severe: "Emergency intervention",
};

/** The worked example reported in the paper's case study (Section 7.3). */
export const caseStudy = {
  asset: "500 kV STN transmission asset",
  component: "Stockbridge damper",
  defect: "Corrosion",
  vlmSeverity: "moderate" as Severity,
  vlmSeverityLabel: "Level 2 of 3 (moderate)",
  vlmConfidence: "1.00",
  dampingHealth: 0.347,
  riskScore: 0.479,
  conductorDropRisk: "0.95",
  standard: "IEC 61284",
  action: "Hardware replacement",
} as const;
