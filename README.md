# AI Sales Role-Play Coach: Evaluation Framework, Coaching Insights and Scenarios

What makes a negotiator someone the other side wants to deal with again, and can a simple, explainable rubric score that from a transcript? This project builds the pieces an AI role-play coach needs, in TypeScript:

1. **Coaching insights**: which behaviours are linked to the counterpart liking you, and which ones cost you.
2. **An evaluation rubric** with six transparent behaviour detectors, checked against human labels.
3. **A coaching score** tested on held-out conversations.
4. **Feedback reports** with "try next time" tips and real example lines.
5. **Role-play scenario cards and prompts** for an AI counterpart and an AI judge.

**Data:** [CaSiNo](https://github.com/kushalchawla/CaSiNo) (Chawla et al., NAACL 2021, CC BY 4.0): **1,030 real negotiation role-plays** between people, 11,919 messages. Two campers negotiate over Food, Water and Firewood, each with private priorities. After each chat, both rate their satisfaction and **how much they liked the other person**. 393 dialogues also have human labels for the strategy in each message. The repo's own train/test split is used, so the 100 test dialogues are never used for tuning.

## Key findings

| Area | Finding |
|---|---|
| Small talk | People who made small talk were liked more by their counterpart (**4.21 vs 3.79** out of 5, p = 0.0002) and scored the same points (18.8 vs 18.6). Rapport costs nothing. |
| Undermining needs | Dismissing the other side's needs ("you don't really need that much water") was the biggest penalty: liked **3.65 vs 4.14** (p = 0.0002), with **no gain in points**. |
| Fairness appeals | Appealing to fairness ("that's not fair", "let's keep it even") lowered liking (**3.96 vs 4.16**, p = 0.02). In practice it is often used as pressure, so the coach never suggests it as a tip. |
| Giving things away | Offering items you don't need raised liking (**4.29 vs 4.02**, p = 0.007) but cost **0.6 points** (p = 0.04). Good for relationships, not free. |
| Detectors | The six rule-based detectors reach an **F1 of 0.33–0.53 (mean 0.45)** against human labels on 481 held-out messages. They are a transparent baseline, not a final judge. |
| Coaching score | On 200 held-out participants the score correlates with how much the counterpart liked them (Spearman **0.16**, permutation p = 0.03). The top fifth by score were rated **4.55 vs 4.05** for the bottom fifth. |
| Score limits | The same score does **not** predict points (Spearman −0.03). Being liked and winning value are different skills, so a coach needs two scores, not one. |

Method notes: insights use the human strategy labels (786 annotated participants) and a two-sided permutation test (5,000 shuffles). Detectors were tuned on the training split's labels only. The coaching score is a linear model on detector rates plus talk share, fitted on 1,860 training participants.

## Outputs

| File | What it is |
|---|---|
| `results/results.json` | Every number above |
| `reports/sample_feedback.md` | Coaching reports for the highest- and lowest-scoring held-out participants |
| `scenarios/scenario_cards.json` | 10 role-play cards built from real participant briefs (priorities, reasons, style) |
| `prompts/roleplay_buyer.md` | Prompt template for an AI counterpart that reveals priorities only when asked well |
| `prompts/judge_rubric.md` | Prompt template for an AI judge that scores a transcript on the rubric with quoted evidence |

The prompts are templates for any LLM (for example on AWS Bedrock). This repo does not call a model. The next step would be to run the judge on human-labelled dialogues and check it against the labels, the same way the rule-based detectors are checked here.

## Structure

```
src/data.ts       load CaSiNo, align strategy labels, build participant records
src/rubric.ts     six behaviour detectors + validation against human labels
src/stats.ts      Spearman, permutation test, least squares (no dependencies)
src/scenarios.ts  role-play cards and prompt templates
src/feedback.ts   coaching report generator
src/run.ts        runs everything and writes the outputs
```

## Run

```bash
npm install
npm run data      # downloads CaSiNo at a pinned commit and checks its SHA-256
npm run build
npm start
```

## Limits
- The chats are about camping supplies, not software sales. The behaviours (asking about needs, rapport, trade offers) carry over, but the effect sizes may not.
- Ratings come from crowd workers role-playing, not real buyers.
- The detectors are simple rules with moderate accuracy. They make the rubric explainable; an LLM judge should be validated before it replaces them.
- Correlations are not causal: well-liked negotiators might make small talk *because* the chat is going well.
