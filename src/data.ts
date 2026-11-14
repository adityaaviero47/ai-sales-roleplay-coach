import * as fs from "fs";

// Raw CaSiNo format (see data/README in the CaSiNo repo)
interface ChatLog { text: string; id: string; task_data: Record<string, unknown>; }
interface AgentInfo {
  value2issue: Record<string, string>;
  value2reason: Record<string, string>;
  outcomes: { points_scored: number; satisfaction: string; opponent_likeness: string };
  personality: { svo: string; "big-five": Record<string, number> };
}
interface RawDialogue {
  dialogue_id: number;
  chat_logs: ChatLog[];
  participant_info: Record<string, AgentInfo>;
  annotations: [string, string][] | null;
}

export interface Utterance { text: string; labels: string[] | null; }

export interface Participant {
  dialogueId: number;
  agent: string;
  utterances: Utterance[];
  words: number;
  partnerWords: number;
  points: number;
  partnerPoints: number;
  satisfaction: number;      // 1-5, own rating of the outcome
  likedByPartner: number;    // 1-5, how much the partner liked this participant
  dealReached: boolean;
  annotated: boolean;
  info: AgentInfo;
}

const DEAL_ACTIONS = new Set(["Submit-Deal", "Accept-Deal", "Reject-Deal", "Walk-Away"]);

const SATISFACTION: Record<string, number> = {
  "Extremely dissatisfied": 1, "Slightly dissatisfied": 2, "Undecided": 3,
  "Slightly satisfied": 4, "Extremely satisfied": 5,
};
const LIKENESS: Record<string, number> = {
  "Extremely dislike": 1, "Slightly dislike": 2, "Undecided": 3,
  "Slightly like": 4, "Extremely like": 5,
};

const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;

export function loadParticipants(path: string): Participant[] {
  const raw: RawDialogue[] = JSON.parse(fs.readFileSync(path, "utf8"));
  const out: Participant[] = [];
  for (const d of raw) {
    const msgs = d.chat_logs.filter(m => !DEAL_ACTIONS.has(m.text));
    // Annotations list the non-action messages in order; align only when lengths match.
    const ann = d.annotations && d.annotations.length === msgs.length ? d.annotations : null;
    const accepted = d.chat_logs.some(m => m.text === "Accept-Deal");
    const agents = Object.keys(d.participant_info);
    for (const agent of agents) {
      const partner = agents.find(a => a !== agent)!;
      const mine: Utterance[] = [];
      let words = 0, partnerWords = 0;
      msgs.forEach((m, i) => {
        if (m.id === agent) {
          mine.push({ text: m.text, labels: ann ? ann[i][1].split(",").filter(Boolean) : null });
          words += wordCount(m.text);
        } else partnerWords += wordCount(m.text);
      });
      const me = d.participant_info[agent], them = d.participant_info[partner];
      out.push({
        dialogueId: d.dialogue_id, agent, utterances: mine, words, partnerWords,
        points: me.outcomes.points_scored, partnerPoints: them.outcomes.points_scored,
        satisfaction: SATISFACTION[me.outcomes.satisfaction] ?? NaN,
        likedByPartner: LIKENESS[them.outcomes.opponent_likeness] ?? NaN,
        dealReached: accepted, annotated: ann !== null, info: me,
      });
    }
  }
  return out;
}

export function loadTestIds(path: string): Set<number> {
  const raw: RawDialogue[] = JSON.parse(fs.readFileSync(path, "utf8"));
  return new Set(raw.map(d => d.dialogue_id));
}
