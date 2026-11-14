import { Participant } from "./data";
import { BEHAVIOURS, Behaviour, LABEL, detect } from "./rubric";

// Builds a short coaching report for one participant: what they did, where they rank,
// and the two behaviours that would most lift their score, with a real example line.

export function feedbackReport(
  p: Participant, score: number, cohort: number[], w: number[],
  featureNames: string[], examples: Record<Behaviour, string>, avoid: Set<Behaviour>,
): string {
  const n = Math.max(p.utterances.length, 1);
  const used = BEHAVIOURS.map(b => ({ b, count: p.utterances.filter(u => detect(u.text).has(b)).length }));
  const percentile = Math.round((100 * cohort.filter(s => s <= score).length) / cohort.length);
  const gains = used
    .map(({ b, count }) => ({ b, count, weight: w[featureNames.indexOf(b) + 1] }))
    .filter(x => x.weight > 0 && !avoid.has(x.b))
    .sort((a, b) => a.count / n - b.count / n || b.weight - a.weight)
    .slice(0, 2);

  const lines = [
    `## Coaching report: dialogue ${p.dialogueId}, ${p.agent}`,
    "",
    `- Outcome: ${p.points} points; partner rated them ${p.likedByPartner}/5; deal ${p.dealReached ? "reached" : "not reached"}`,
    `- Coaching score: ${score.toFixed(2)} (better than ${percentile}% of the training cohort)`,
    "",
    "| Behaviour | Times used |",
    "|---|---|",
    ...used.map(({ b, count }) => `| ${LABEL[b]} | ${count} of ${p.utterances.length} messages |`),
    "",
    "**Try next time:**",
    ...gains.map(g => `- ${LABEL[g.b]}${examples[g.b] ? `, e.g. "${examples[g.b]}"` : ""}`),
  ];
  return lines.join("\n");
}
