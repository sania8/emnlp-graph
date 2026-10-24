/**
 * Facts for the NLDB 2026 paper on interpretable financial sentiment reasoning.
 *
 * Every value here is taken directly from:
 *   "When Words Move Markets: Interpretable Behavioural and Robustness
 *    Analysis of LLMs for Financial Sentiment Reasoning via Local Perturbation
 *    Explanations", Verma et al., NLDB 2026, Springer LNCS 16696, pp. 271–286.
 *
 * Nothing is estimated. Where the paper does not publish a number, the UI says
 * so rather than inventing one.
 */

export const paper = {
  title:
    "When Words Move Markets: Interpretable Behavioural and Robustness Analysis of LLMs for Financial Sentiment Reasoning via Local Perturbation Explanations",
  shortTitle: "When Words Move Markets",
  venue: "NLDB 2026 — 31st International Conference on Natural Language & Information Systems",
  series: "Springer LNCS, volume 16696, pp. 271–286",
  doi: "https://doi.org/10.1007/978-3-032-29532-3_19",
  role: "First author",
  authors: [
    { name: "Sania Verma", affiliation: "City, St George's University of London, UK" },
    { name: "Koorosh Aslansefat", affiliation: "University of Hull, UK" },
    {
      name: "Joyjit Chatterjee",
      affiliation: "University of Hull · EPAM Systems · Loughborough University, UK",
    },
    { name: "Akash Marar", affiliation: "EPAM Systems, London, UK" },
    { name: "Anu Mehra", affiliation: "Amity University, Noida, India" },
    { name: "Aisha Ekundayo", affiliation: "EPAM Systems, London, UK" },
  ],
  disclaimer:
    "Carried out as an independent research project by the authors. Views and methodologies presented are those of the authors and do not represent EPAM Systems.",
} as const;

export const researchQuestions = [
  {
    id: "RQ1",
    q: "What token-level and contextual evidence do LLMs rely on when producing sentiment predictions for financial news text?",
  },
  {
    id: "RQ2",
    q: "How stable are sentiment predictions when identical financial news sentences are repeatedly queried?",
  },
  {
    id: "RQ3",
    q: "Which tokens contributed most to specific predictions, and are those contributions consistent across different LLMs?",
  },
] as const;

export const dataset = [
  { label: "Source", value: "Financial PhraseBank" },
  { label: "Agreement variant", value: "75%" },
  { label: "Original sentences", value: "3,453" },
  { label: "After synonym augmentation", value: "5,151" },
  { label: "Samples per sentiment class", value: "1,717" },
  { label: "Train / test split", value: "80 : 20" },
  { label: "Expert annotators", value: "16" },
] as const;

export type ModelKey = "gemma" | "mistral" | "qwen";

export const models: Record<
  ModelKey,
  {
    key: ModelKey;
    name: string;
    vendor: string;
    params: string;
    note: string;
    /** Fine-tuning hyperparameters, exactly as published in Table 1. */
    config: { label: string; value: string }[];
    /** One-line behavioural verdict from the conclusion. */
    verdict: string;
  }
> = {
  gemma: {
    key: "gemma",
    name: "Gemma-3-270M",
    vendor: "Google",
    params: "270M",
    note: "Lightweight; compact size enabled faster inference and lower memory use.",
    config: [
      { label: "Fine-tuning", value: "LoRA" },
      { label: "LoRA rank / alpha", value: "16 / 16" },
      { label: "Epochs", value: "20" },
      { label: "Learning rate", value: "2e−4" },
      { label: "Batch size (train/eval)", value: "1 / 1" },
      { label: "Gradient accumulation", value: "8" },
      { label: "Max input tokens", value: "2048" },
      { label: "Dropout", value: "0" },
      { label: "Precision", value: "FP16" },
    ],
    verdict:
      "Highly robust to perturbation — but uniformly so, which may indicate reliance on coarse-grained patterns rather than fine-grained semantic reasoning.",
  },
  mistral: {
    key: "mistral",
    name: "Mistral-7B-Instruct-v0.1",
    vendor: "Mistral AI",
    params: "7B",
    note: "Loaded with 4-bit quantization; max token length reduced to 128 due to memory overhead.",
    config: [
      { label: "Fine-tuning", value: "QLoRA" },
      { label: "LoRA rank / alpha", value: "64 / 32" },
      { label: "Epochs", value: "15" },
      { label: "Learning rate", value: "3e−4" },
      { label: "Batch size (train/eval)", value: "1 / 1" },
      { label: "Gradient accumulation", value: "16" },
      { label: "Max input tokens", value: "128" },
      { label: "Dropout", value: "0.05" },
      { label: "Precision", value: "FP16" },
    ],
    verdict:
      "The most balanced and stable behaviour, distributing importance across multiple tokens rather than concentrating it on one.",
  },
  qwen: {
    key: "qwen",
    name: "Qwen-2.5-0.5B-Instruct",
    vendor: "Alibaba",
    params: "0.5B",
    note: "Chosen for its balance of parameter scale and compute efficiency on instruction-following tasks.",
    config: [
      { label: "Fine-tuning", value: "LoRA" },
      { label: "LoRA rank / alpha", value: "8 / 16" },
      { label: "Epochs", value: "15" },
      { label: "Learning rate", value: "5e−5" },
      { label: "Batch size (train/eval)", value: "2 / 2" },
      { label: "Gradient accumulation", value: "4" },
      { label: "Max input tokens", value: "2048" },
      { label: "Dropout", value: "0.15" },
      { label: "Precision", value: "FP16" },
    ],
    verdict:
      "The most fragile model — small lexical changes led to large shifts in sentiment prediction.",
  },
};

export const MODEL_ORDER: ModelKey[] = ["gemma", "mistral", "qwen"];

export type Sentiment = "Positive" | "Neutral" | "Negative";

export type TokenAttribution = {
  token: string;
  /** Published GSMILE importance score, or null when the paper does not give one. */
  score: number | null;
};

export type SentenceCase = {
  id: "S1" | "S2";
  text: string;
  tokens: string[];
  truth: Sentiment;
  perModel: Record<
    ModelKey,
    {
      prediction: Sentiment;
      /** Published confidence, when the paper reports one. */
      confidence: string | null;
      attributions: TokenAttribution[];
      /** The token removed in the paper's ablation. */
      ablatedToken: string;
      ablatedScore: number;
      afterPrediction: Sentiment;
      afterConfidence: string | null;
      shifted: boolean;
      /** The paper's interpretation of that outcome. */
      reading: string;
    }
  >;
};

/**
 * Token lists mirror the words of each sentence as presented in the paper.
 * Scores are only attached to tokens whose importance the paper states; all
 * other tokens carry `null` and are rendered as "not reported".
 */
export const sentences: SentenceCase[] = [
  {
    id: "S1",
    text: "The company reported increased profits this quarter",
    tokens: [
      "The",
      "company",
      "reported",
      "increased",
      "profits",
      "this",
      "quarter",
    ],
    truth: "Positive",
    perModel: {
      gemma: {
        prediction: "Positive",
        confidence: null,
        attributions: [
          { token: "The", score: null },
          { token: "company", score: null },
          { token: "reported", score: null },
          { token: "increased", score: 0.363 },
          { token: "profits", score: 0.201 },
          { token: "this", score: null },
          { token: "quarter", score: null },
        ],
        ablatedToken: "increased",
        ablatedScore: 0.363,
        afterPrediction: "Neutral",
        afterConfidence: null,
        shifted: true,
        reading:
          "Removing the top token flipped the prediction, showing the word's critical role in driving the model towards a positive sentiment.",
      },
      mistral: {
        prediction: "Positive",
        confidence: "100%",
        attributions: [
          { token: "The", score: null },
          { token: "company", score: null },
          { token: "reported", score: null },
          { token: "increased", score: 0.531 },
          { token: "profits", score: null },
          { token: "this", score: 0.126 },
          { token: "quarter", score: null },
        ],
        ablatedToken: "increased",
        ablatedScore: 0.531,
        afterPrediction: "Neutral",
        afterConfidence: "87.84%",
        shifted: true,
        reading:
          "The remaining sentence still reads positively to a human, yet the model marked it neutral — evidence that contextual cues outweigh isolated sentiment-bearing words.",
      },
      qwen: {
        prediction: "Positive",
        confidence: "53%",
        attributions: [
          { token: "The", score: null },
          { token: "company", score: null },
          { token: "reported", score: null },
          { token: "increased", score: 0.305 },
          { token: "profits", score: null },
          { token: "this", score: null },
          { token: "quarter", score: null },
        ],
        ablatedToken: "increased",
        ablatedScore: 0.305,
        afterPrediction: "Neutral",
        afterConfidence: "92.77%",
        shifted: true,
        reading:
          "The same dominant token appears across all three models, but Qwen's initial confidence was by far the lowest at 53%.",
      },
    },
  },
  {
    id: "S2",
    text: "The project failed to meet its targets, yet the team showed remarkable resilience.",
    tokens: [
      "The",
      "project",
      "failed",
      "to",
      "meet",
      "its",
      "targets",
      "yet",
      "the",
      "team",
      "showed",
      "remarkable",
      "resilience",
    ],
    truth: "Positive",
    perModel: {
      gemma: {
        prediction: "Positive",
        confidence: null,
        attributions: [
          { token: "The", score: null },
          { token: "project", score: null },
          { token: "failed", score: null },
          { token: "to", score: null },
          { token: "meet", score: null },
          { token: "its", score: null },
          { token: "targets", score: null },
          { token: "yet", score: 0.115 },
          { token: "the", score: null },
          { token: "team", score: null },
          { token: "showed", score: null },
          { token: "remarkable", score: 0.191 },
          { token: "resilience", score: null },
        ],
        ablatedToken: "remarkable",
        ablatedScore: 0.191,
        afterPrediction: "Positive",
        afterConfidence: null,
        shifted: false,
        reading:
          "Removing the top token changed nothing — \u201cyet\u201d had already neutralised the negative clause, showing sensitivity to structural words over lexical sentiment cues.",
      },
      mistral: {
        prediction: "Neutral",
        confidence: "99.32%",
        attributions: [
          { token: "The", score: null },
          { token: "project", score: null },
          { token: "failed", score: null },
          { token: "to", score: null },
          { token: "meet", score: null },
          { token: "its", score: null },
          { token: "targets", score: null },
          { token: "yet", score: 0.212 },
          { token: "the", score: null },
          { token: "team", score: null },
          { token: "showed", score: null },
          { token: "remarkable", score: null },
          { token: "resilience", score: null },
        ],
        ablatedToken: "yet",
        ablatedScore: 0.212,
        afterPrediction: "Neutral",
        afterConfidence: null,
        shifted: false,
        reading:
          "The concessive connective balanced the negative and positive clauses. Removing it left the prediction unchanged, revealing the distributed, context-dependent nature of transformer reasoning.",
      },
      qwen: {
        prediction: "Neutral",
        confidence: null,
        attributions: [
          { token: "The", score: null },
          { token: "project", score: null },
          { token: "failed", score: 0.161 },
          { token: "to", score: null },
          { token: "meet", score: null },
          { token: "its", score: null },
          { token: "targets", score: null },
          { token: "yet", score: 0.177 },
          { token: "the", score: null },
          { token: "team", score: null },
          { token: "showed", score: null },
          { token: "remarkable", score: null },
          { token: "resilience", score: 0.145 },
        ],
        ablatedToken: "yet",
        ablatedScore: 0.177,
        afterPrediction: "Negative",
        afterConfidence: null,
        shifted: true,
        reading:
          "With the connective gone, the opening negative clause dominated and the prediction flipped to negative — highlighting the model's fragility to minute lexical changes.",
      },
    },
  },
];

/** Importance banding used in the paper (scores normalised to max per sentence). */
export const importanceBands = [
  { level: "Very high", range: "> 75%" },
  { level: "High", range: "50 – 75%" },
  { level: "Medium", range: "25 – 50%" },
  { level: "Low", range: "10 – 25%" },
  { level: "Negligible", range: "< 10%" },
] as const;

/**
 * Modifier-intensifier robustness on S2 (Section 5.2). Ranges are the published
 * minimum–maximum confidence observed across controlled modifiers.
 */
export const robustness: Record<
  ModelKey,
  {
    summary: string;
    words: { word: string; min: number; max: number }[] | null;
    headline: string;
  }
> = {
  mistral: {
    summary:
      "Maintains high confidence across most perturbations; 87% of predictions exceeded 90% confidence.",
    headline: "87% of predictions > 0.90 confidence",
    words: [
      { word: "yet", min: 0.861, max: 0.994 },
      { word: "showed", min: 0.802, max: 0.995 },
      { word: "resilience", min: 0.791, max: 0.989 },
    ],
  },
  qwen: {
    summary:
      "Extreme sensitivity to modifier placement and intensity, with systematic underperformance on negatively-balanced and contextually critical words.",
    headline: "Only 40% > 0.90 · another 40% below 0.80",
    words: [
      { word: "yet", min: 0.496, max: 0.932 },
      { word: "failed", min: 0.533, max: 0.963 },
      { word: "resilience", min: 0.689, max: 0.785 },
    ],
  },
  gemma: {
    summary:
      "Achieved 100% confidence across all modifiers — a uniform baseline that indicates a lack of responsiveness to contextual cues rather than genuine robustness.",
    headline: "100% confidence across every modifier",
    words: null,
  },
};

/** Repeated-inference consistency check (Section 4.2, Table 2). */
export const consistency = {
  statements: 5,
  runsEach: 10,
  statementsTable: [
    {
      text: "Validating our fgVoIP client through Symbian Signed represents a significant step forward…",
      truth: "Pos",
      mistral: "Pos",
      gemma: "Pos",
      qwen: "Pos",
      flagged: false,
    },
    {
      text: "At end-August, Sampo was Nordea's biggest shareholder with a 20.6% stake…",
      truth: "Neu",
      mistral: "Neu",
      gemma: "Neu",
      qwen: "Neu",
      flagged: false,
    },
    {
      text: "The poorest index fig. was given to Finnish power company Fortum, 4.5.",
      truth: "Neg",
      mistral: "Neg",
      gemma: "Neg",
      qwen: "Neg",
      flagged: false,
    },
    {
      text: "The share subscription period for C options will commence on 1 Sept 2008…",
      truth: "Neu",
      mistral: "Neu",
      gemma: "Neu",
      qwen: "Pos",
      flagged: true,
    },
    {
      text: "Kickoff quarter underlying operating profit rose to 41 mln EUR from 33 mln…",
      truth: "Pos",
      mistral: "Pos",
      gemma: "Pos",
      qwen: "Pos",
      flagged: false,
    },
  ],
  finding:
    "Every prediction was identical across all 10 runs, so the models behave deterministically. But statement 4 shows the catch: Qwen was consistently wrong, which means inference stability can mask a systematic misclassification rather than prove correctness.",
} as const;

export const takeaways = [
  {
    title: "Keywords alone do not explain a prediction",
    body: "\u201cincreased\u201d is consistently associated with positive sentiment across all three models, yet its influence is entirely context-dependent. Removing it shifted the prediction from positive to neutral in every model — a strong but non-independent contribution.",
  },
  {
    title: "Structure outweighs lexicon",
    body: "The concessive connective \u201cyet\u201d repeatedly carried more weight than overtly sentiment-bearing words like \u201cfailed\u201d or \u201cremarkable\u201d, with models reading clause balance rather than word polarity.",
  },
  {
    title: "Stability is not correctness",
    body: "All models produced deterministic outputs across repeated runs. That consistency concealed a persistent misclassification rather than demonstrating reliability.",
  },
  {
    title: "Accuracy alone cannot justify deployment",
    body: "Under regimes such as the EU AI Act, high-risk systems need auditability. Three models with comparable task performance exhibited markedly different reasoning styles and sensitivities.",
  },
] as const;
