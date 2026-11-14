import * as fs from "fs";
import { loadParticipants, loadTestIds, Participant } from "./data";
import { BEHAVIOURS, Behaviour, HUMAN_LABELS, LABEL, detect, validateDetectors } from "./rubric";
import { mean, mulberry32, ols, permutationP, round, spearman } from "./stats";
import { buildScenarios, JUDGE_PROMPT, buyerPrompt } from "./scenarios";
import { feedbackReport } from "./feedback";

const people = loadParticipants("data/casino.json");
const testIds = loadTestIds("data/casino_test.json");
const results: Record<string, unknown> = {};

// ---------- 1. Data checks ----------
const annotated = people.filter(p => p.annotated);
results.data = {
  dialogues: new Set(people.map(p => p.dialogueId)).size,
  participants: people.length,
  annotated_dialogues: new Set(annotated.map(p => p.dialogueId)).size,
  utterances: people.reduce((s, p) => s + p.utterances.length, 0),
  deal_rate: round(mean(people.map(p => (p.dealReached ? 1 : 0)))),
  test_dialogues: testIds.size,
};

// ---------- 2. Validate the rubric's detectors against human labels ----------
const rows = (g: Participant[]) => g.flatMap(p => p.utterances.map(u => ({ text: u.text, labels: u.labels ?? [] })));
const tuneRows = rows(annotated.filter(p => !testIds.has(p.dialogueId)));
const heldOutRows = rows(annotated.filter(p => testIds.has(p.dialogueId)));
const detectorScores = validateDetectors(heldOutRows);
const tuneScores = validateDetectors(tuneRows);
results.detector_validation = {
  tuning_utterances: tuneRows.length, held_out_utterances: heldOutRows.length,
  held_out: detectorScores.map(s => ({
    behaviour: s.behaviour, precision: round(s.precision), recall: round(s.recall), f1: round(s.f1), support: s.support,
  })),
  tuning_f1: Object.fromEntries(tuneScores.map(s => [s.behaviour, round(s.f1)])),
  held_out_mean_f1: round(mean(detectorScores.map(s => s.f1))),
};

// ---------- 3. Coaching insights from human strategy labels ----------
const STRATEGIES = ["elicit-pref", "showing-empathy", "small-talk", "promote-coordination",
  "vouch-fair", "self-need", "other-need", "no-need", "uv-part"];
const insights = STRATEGIES.map(s => {
  const used = annotated.filter(p => p.utterances.some(u => u.labels?.includes(s)));
  const not = annotated.filter(p => !p.utterances.some(u => u.labels?.includes(s)));
  const liked = (g: Participant[]) => g.map(p => p.likedByPartner);
  return {
    strategy: s, used_by: used.length, not_used_by: not.length,
    liked_by_partner_used: round(mean(liked(used)), 2), liked_by_partner_not: round(mean(liked(not)), 2),
    liked_p: round(permutationP(liked(used), liked(not)), 4),
    points_used: round(mean(used.map(p => p.points)), 2), points_not: round(mean(not.map(p => p.points)), 2),
    points_p: round(permutationP(used.map(p => p.points), not.map(p => p.points)), 4),
  };
});
results.strategy_insights = insights;
// Behaviours whose human label is linked to being liked LESS (p < 0.05) are never suggested as tips.
const avoid = new Set(BEHAVIOURS.filter(b => insights.some(i =>
  HUMAN_LABELS[b].includes(i.strategy) && i.liked_by_partner_used < i.liked_by_partner_not && i.liked_p < 0.05)));
results.never_suggested = [...avoid];

// ---------- 4. Coaching score: rubric features -> outcomes, tested on held-out dialogues ----------
function features(p: Participant): number[] {
  const n = Math.max(p.utterances.length, 1);
  const shares = BEHAVIOURS.map(b => p.utterances.filter(u => detect(u.text).has(b)).length / n);
  const talkShare = p.words / Math.max(p.words + p.partnerWords, 1);
  return [...shares, talkShare];
}
const FEATURE_NAMES = [...BEHAVIOURS, "talkShare"];
const train = people.filter(p => !testIds.has(p.dialogueId));
const test = people.filter(p => testIds.has(p.dialogueId));
const Xtr = train.map(features), Xte = test.map(features);

function fitAndTest(target: (p: Participant) => number) {
  const w = ols(Xtr, train.map(target));
  const predict = (x: number[]) => w[0] + x.reduce((s, v, i) => s + v * w[i + 1], 0);
  const pred = Xte.map(predict), actual = test.map(target);
  const rho = spearman(pred, actual);
  // Permutation p-value: shuffle outcomes and count how often |rho| is at least as large
  const rng = mulberry32(7); let hits = 0; const ITERS = 5000; const y = actual.slice();
  for (let it = 0; it < ITERS; it++) {
    for (let i = y.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [y[i], y[j]] = [y[j], y[i]]; }
    if (Math.abs(spearman(pred, y)) >= Math.abs(rho)) hits++;
  }
  return { w, predict, testSpearman: rho, p: (hits + 1) / (ITERS + 1) };
}
const likeModel = fitAndTest(p => p.likedByPartner);
const pointsModel = fitAndTest(p => p.points);
const satModel = fitAndTest(p => p.satisfaction);
results.coaching_score = {
  train_participants: train.length, test_participants: test.length,
  test_spearman: {
    liked_by_partner: round(likeModel.testSpearman), points: round(pointsModel.testSpearman),
    satisfaction: round(satModel.testSpearman),
  },
  test_p: { liked_by_partner: round(likeModel.p, 4), points: round(pointsModel.p, 4), satisfaction: round(satModel.p, 4) },
  weights_liked_by_partner: Object.fromEntries(FEATURE_NAMES.map((f, i) => [f, round(likeModel.w[i + 1], 2)])),
  weights_points: Object.fromEntries(FEATURE_NAMES.map((f, i) => [f, round(pointsModel.w[i + 1], 2)])),
};

// Top vs bottom fifth of test participants by predicted coaching score
const scored = test.map((p, i) => ({ p, s: likeModel.predict(Xte[i]) })).sort((a, b) => b.s - a.s);
const fifth = Math.floor(scored.length / 5);
const top = scored.slice(0, fifth).map(x => x.p), bottom = scored.slice(-fifth).map(x => x.p);
results.score_check = {
  top_fifth_liked: round(mean(top.map(p => p.likedByPartner)), 2),
  bottom_fifth_liked: round(mean(bottom.map(p => p.likedByPartner)), 2),
  top_fifth_points: round(mean(top.map(p => p.points)), 2),
  bottom_fifth_points: round(mean(bottom.map(p => p.points)), 2),
};

// ---------- 5. Role-play scenarios and prompts (templates, not run against a model) ----------
const scenarios = buildScenarios(people.filter(p => testIds.has(p.dialogueId)), 10);
fs.writeFileSync("scenarios/scenario_cards.json", JSON.stringify(scenarios, null, 2));
fs.writeFileSync("prompts/roleplay_buyer.md", buyerPrompt(scenarios[0]));
fs.writeFileSync("prompts/judge_rubric.md", JUDGE_PROMPT);
results.scenarios = scenarios.length;

// ---------- 6. Sample feedback reports for two held-out participants ----------
const trainScores = Xtr.map(likeModel.predict);
// Example lines come from well-liked participants, where both the human label and the detector agree.
const example = (b: Behaviour) => {
  const best = train.filter(p => p.likedByPartner === 5 && p.annotated)
    .flatMap(p => p.utterances)
    .filter(u => u.labels?.some(l => HUMAN_LABELS[b].includes(l)) && detect(u.text).has(b)
      && u.text.length > 30 && u.text.length < 120
      && (b !== "proposesTogether" || /\b(take|give)\b/i.test(u.text)));
  return best[0]?.text ?? "";
};
const examples = Object.fromEntries(BEHAVIOURS.map(b => [b, example(b)])) as Record<Behaviour, string>;
const picks = [scored[0].p, scored[scored.length - 1].p];
const reports = picks.map(p =>
  feedbackReport(p, likeModel.predict(features(p)), trainScores, likeModel.w, FEATURE_NAMES, examples, avoid));
fs.writeFileSync("reports/sample_feedback.md", reports.join("\n\n---\n\n"));

fs.writeFileSync("results/results.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify({ data: results.data, coaching_score: results.coaching_score, score_check: results.score_check }, null, 2));
console.log("\nDetector validation (held-out labels):");
for (const s of detectorScores) console.log(`  ${LABEL[s.behaviour].padEnd(36)} P=${round(s.precision, 2)} R=${round(s.recall, 2)} F1=${round(s.f1, 2)}`);
