import { Participant } from "./data";

// Turns real participant briefs from CaSiNo into role-play cards for an AI "counterpart".
// The prompts are templates for any LLM (e.g. on AWS Bedrock); this repo does not call a model.

export interface ScenarioCard {
  id: string;
  sourceDialogue: number;
  counterpart: {
    priorities: { high: string; medium: string; low: string };
    reasons: { high: string; medium: string; low: string };
    style: string;
  };
  repGoal: string;
  successCriteria: string[];
}

function style(p: Participant): string {
  const svo = p.info.personality.svo === "prosocial" ? "cooperative" : "self-interested";
  const agree = p.info.personality["big-five"]["agreeableness"];
  const tone = agree >= 5.5 ? "warm" : agree <= 3.5 ? "blunt" : "neutral";
  return `${svo}, ${tone} tone`;
}

export function buildScenarios(pool: Participant[], n: number): ScenarioCard[] {
  return pool.slice(0, n).map((p, i) => {
    const v = p.info.value2issue, r = p.info.value2reason;
    return {
      id: `S${String(i + 1).padStart(2, "0")}`,
      sourceDialogue: p.dialogueId,
      counterpart: {
        priorities: { high: v.High, medium: v.Medium, low: v.Low },
        reasons: { high: r.High, medium: r.Medium, low: r.Low },
        style: style(p),
      },
      repGoal: "Reach a deal on Food, Water and Firewood that meets your own priorities while keeping the counterpart satisfied.",
      successCriteria: [
        "Deal reached (no walk-away)",
        "Rep discovers the counterpart's top priority before making an offer",
        "Counterpart rates the rep 4+ out of 5 on likeability",
      ],
    };
  });
}

export function buyerPrompt(c: ScenarioCard): string {
  return `# Role-play prompt: AI counterpart (scenario ${c.id})

You are role-playing a camper negotiating with a sales rep in training over three packages:
Food, Water and Firewood (3 of each in total).

Your priorities (keep them private unless asked well):
- High: ${c.counterpart.priorities.high} (${c.counterpart.reasons.high})
- Medium: ${c.counterpart.priorities.medium} (${c.counterpart.reasons.medium})
- Low: ${c.counterpart.priorities.low} (${c.counterpart.reasons.low})

Style: ${c.counterpart.style}.

Rules:
1. Reveal a priority only when the rep asks about your needs or explains theirs first.
2. Push back once on any offer that gives you less than 2 of your high-priority item.
3. Accept a deal that gives you at least 2 of your high-priority item; walk away after 12 turns without progress.
4. Stay in character. Keep replies under 40 words.
`;
}

export const JUDGE_PROMPT = `# Evaluation prompt: AI judge for a role-play transcript

Score the rep's side of the transcript from 0 to 2 on each behaviour, quoting the line that justifies each score.
These are the behaviours this project found linked to the counterpart liking the rep (see README).

| Behaviour | 0 | 1 | 2 |
|---|---|---|---|
| Asks what the other side needs | never | once, late | early, before any offer |
| Explains own needs with reasons | no reasons | one reason | clear reasons for top priority |
| Shows empathy | none | generic | specific to the counterpart's reason |
| Makes concrete trade offers | vague asks only | some offers | clear offers that trade low-priority items for high ones |
| Builds rapport | none | greeting only | genuine small talk |
| Undermines the other side's needs (penalty) | never | once | repeatedly |

Return JSON: {"scores": {...}, "evidence": {...}, "top_tip": "..."}.
Check the judge before trusting it: score 50 human-labelled CaSiNo dialogues and compare with the human strategy labels.
`;
