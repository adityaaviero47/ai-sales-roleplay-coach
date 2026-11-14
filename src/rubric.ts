// Transparent behaviour detectors for a coaching rubric.
// Each detector is a plain rule a coach can read and challenge, and each is
// validated against the human strategy labels in CaSiNo (see validateDetectors).

export type Behaviour =
  | "asksPreferences" | "sharesNeeds" | "showsEmpathy" | "appealsToFairness"
  | "buildsRapport" | "proposesTogether";

export const BEHAVIOURS: Behaviour[] = [
  "asksPreferences", "sharesNeeds", "showsEmpathy", "appealsToFairness",
  "buildsRapport", "proposesTogether",
];

export const LABEL: Record<Behaviour, string> = {
  asksPreferences: "Asks what the other side needs",
  sharesNeeds: "Explains own needs with reasons",
  showsEmpathy: "Shows empathy",
  appealsToFairness: "Appeals to fairness",
  buildsRapport: "Builds rapport (small talk)",
  proposesTogether: "Makes concrete trade offers",
};

// Human labels in CaSiNo that each detector should agree with.
export const HUMAN_LABELS: Record<Behaviour, string[]> = {
  asksPreferences: ["elicit-pref"],
  sharesNeeds: ["self-need", "other-need"],
  showsEmpathy: ["showing-empathy"],
  appealsToFairness: ["vouch-fair"],
  buildsRapport: ["small-talk"],
  proposesTogether: ["promote-coordination"],
};

// Rules were tuned on the training split's human labels only; validation is reported on the held-out split.
const YOU = /\b(you|your|yours)\b/i;
const NEED_WORDS = /\b(need|needs|want|prefer|preference|preferences|priorit\w*|important|value|feel about|using|most|least|interested|looking for|enough)\b/i;

const RULES: Record<Behaviour, (t: string) => boolean> = {
  asksPreferences: t => t.includes("?") && YOU.test(t) && NEED_WORDS.test(t),
  sharesNeeds: t => /\b((i|we) (really |definitely |also |would |do |will )?(need|could use|would like|want|have to have|require)|(my|our) (kids|children|family|group|dog|grandma|grandmother|wife|husband|son|sons|daughter|friends|baby|camp)|because|since (we|i)|we('re| are) (going|planning)|i('m| am) (going|planning))\b/i.test(t),
  showsEmpathy: t => /\b(i understand|understandable|that makes sense|sorry|i hear you|i get (it|that)|that sounds|oh no|too bad|i can imagine|unfortunate|bummer|oh dear|relate|poor (you|thing)|that'?s (awful|terrible|rough|tough|hard)|feel better|oh my|yikes|wow, that)\b/i.test(t),
  appealsToFairness: t => /\b(fair|fairly|fairness|split|evenly|equal|equally|compromise|meet (you )?in the middle|both (of us )?(get|benefit|happy)|win-win)\b/i.test(t),
  buildsRapport: t => /\b(hello|hi|hey|how are you|nice to meet|good morning|good evening|have (a )?(great|good|nice|fun|safe)|enjoy|excited|safe trip|great trip|happy camping|first time|can'?t wait|cant wait|fun|welcome|how about you\?|i('m| am) (good|great|doing well))\b/i.test(t),
  proposesTogether: t => /\b(i (can|could|would|will|'ll) (give|offer|let|trade|do)|i('d| would) be willing|would (it|that|you)|will you|if (i|you) (take|give|get)|how about (i|you|we|if)|trade|in exchange|willing to|works for (me|you)|we (can|could) (do|work)|let'?s|work (this|it|something) out|deal\?|does that work|is that (ok|okay|alright))\b/i.test(t),
};

export function detect(text: string): Set<Behaviour> {
  const hits = new Set<Behaviour>();
  for (const b of BEHAVIOURS) if (RULES[b](text)) hits.add(b);
  return hits;
}

export interface DetectorScore { behaviour: Behaviour; precision: number; recall: number; f1: number; support: number; }

export function validateDetectors(utts: { text: string; labels: string[] }[]): DetectorScore[] {
  return BEHAVIOURS.map(b => {
    let tp = 0, fp = 0, fn = 0;
    for (const u of utts) {
      const truth = u.labels.some(l => HUMAN_LABELS[b].includes(l));
      const pred = RULES[b](u.text);
      if (pred && truth) tp++; else if (pred) fp++; else if (truth) fn++;
    }
    const precision = tp / Math.max(tp + fp, 1), recall = tp / Math.max(tp + fn, 1);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { behaviour: b, precision, recall, f1, support: tp + fn };
  });
}
