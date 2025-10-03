// /api/bettybank.js
export const detectiveQuestions = {
  rapport: [
    "Thanks for meeting with me. Can we walk through what happened with the hamper",
    "In your own words, how did this start"
  ],
  discovery: [
    "Who arranged the hamper and how did it get to you",
    "When exactly did it arrive and where was it delivered",
    "Was there a note with it and what did it say",
    "Who at Acme knows you received it"
  ],
  valuation: [
    "Roughly how much do you think the hamper is worth",
    "Was alcohol included"
  ],
  linkage: [
    "What was happening with ClientCo’s renewal at that time",
    "Did anyone mention the renewal when the gift came up"
  ],
  intent: [
    "Why do you think they sent it to you specifically",
    "How might this look to someone outside the situation"
  ],
  policy: [
    "What do you recall from Acme’s policy on gifts",
    "How does the policy handle gifts during negotiations"
  ],
  commitment: [
    "Are you okay to disclose this today if I send the link",
    "Would you be willing to return or donate the hamper if required"
  ]
};

export const responseBank = {
  cooperative: [
    "Sure, happy to walk through it. It arrived by courier the week before our renewal meeting.",
    "Raj at ClientCo is my main contact. There was a card about locking in the renewal.",
    "I guessed the value at about 150. It looked premium though.",
    "If disclosure or returning is required, I can do that. Please send the link."
  ],
  defensive: [
    "It was just a nice gesture. People get small gifts all the time.",
    "I did not ask for it and it did not affect my judgment.",
    "Do you have the authority to tell me what I can accept off the clock"
  ],
  minimizing: [
    "It is just a hamper, not cash.",
    "If it is slightly over the limit, I can chip in personally."
  ],
  curious: [
    "What exactly does the policy say about gifts during negotiations",
    "If I disclose now, will I get in trouble"
  ]
};

// Simple tone heuristic if you want to hint the model
export function detectToneFromText(t) {
  const s = (t || "").toLowerCase().trim();
  if (!s) return "neutral";
  if (/[!?]{2,}/.test(s) || /(obviously|clearly)/.test(s)) return "accusatory";
  if (/(policy|clause|section)/.test(s)) return "legalistic";
  if (/(quick|now|fast)/.test(s)) return "rushed";
  if (/(thank|appreciate|help)/.test(s)) return "supportive";
  if (/\?$/.test(s)) return "probing";
  return "neutral";
}
