# Evaluation prompt: AI judge for a role-play transcript

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
