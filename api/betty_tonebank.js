// /api/betty_tonebank.js
// Betty — tone-bank bot for Storyline. Plain-text reply in { ok:true, reply }.
// Self-contained (no external deps). Includes "successful outcome" closers.

"use strict";

/* ---------- CORS ---------- */
function setCORS(res){
  try{
    res.setHeader("Access-Control-Allow-Origin","*");
    res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers","Content-Type, Accept");
  }catch{}
}

/* ---------- Utilities ---------- */
const clamp = (s, n=340) => (s==null ? "" : String(s)).slice(0, n);
const norm  = (s) => (s==null ? "" : String(s)).toLowerCase();
const rnd   = (arr) => arr[Math.floor(Math.random() * arr.length)];

const isYesNo   = (m) => /^\s*(do|does|did|is|are|am|can|could|may|might|will|would|have|has|had|should)\b/i.test(m.trim());
const isExplain = (m) => /(tell me|walk me|talk me|explain|run me through|describe)/i.test(m);
const asksWho   = (m) => /(who (sent|provided)|who.*(from|sender)|where.*came from|who gave)/i.test(m);
const asksValue = (m) => /(how much|value|worth|price|cost|approx(imate)? value|roughly)/i.test(m);

/* ---------- Tone detection ---------- */
function detectTone(msg){
  const m = norm(msg);

  if (/(!{2,}|you lied|obviously|ridiculous|unbelievable|\bnow\b.*\banswer\b)/i.test(msg) ||
      /(shut up|listen|answer me)/i.test(m)) return "aggressive";

  if (/(you (should|must)|you knew|you realised|against policy|breach|violate|why did you)/i.test(m)) return "accusatory";

  if (/(section \d|per policy|as per|threshold|sub clause|pursuant|hereby|therefore)/i.test(m)) return "legalistic";

  if (/(asap|quick|hurry|fast|right now|urgent)/i.test(m)) return "rushed";

  if (/(could you|please|thanks|thank you|appreciate)/i.test(m)) return "polite";

  if (/(\?|help me understand|what happened|can you clarify)/i.test(m)) return "probing";

  return "neutral";
}

/* ---------- Banks: tone -> short/long/follow ---------- */
const BANK = {
  polite: {
    short: ["Yes, that makes sense.","No, that didn’t happen.","I believe so, yes.","Not to my knowledge.","Yes—happy to confirm.","No—let me clarify that."],
    long:  ["Sure—here’s the short version.","Of course—let me explain briefly.","Happy to walk you through it.","Yes, I can outline it simply.","Let me give you the basics.","I’ll keep it straightforward."],
    follow:["Would you like the exact details logged?","Do you want me to add that to the form?","Shall I note that in the disclosure?","Do you want the receipt value as well?","Should I write that up now?","Do you want me to summarise it?"]
  },
  probing: {
    short: ["Yes, that’s right.","No, not in this case.","Yes—within reason.","No, that wouldn’t apply.","Yes, as far as I recall.","No—different situation here."],
    long:  ["Here’s what happened in simple terms.","Let me walk you through the basics.","I’ll outline the key points.","Here’s the relevant bit.","Let me sketch the timeline.","Here’s the gist."],
    follow:["What else should I clarify?","Do you want the timing pinned down?","Shall I get the exact amount?","Do you want names confirmed?","Should I list who was informed?","Need me to check the emails?"]
  },
  supportive: {
    short: ["Yes—thanks for checking.","No—appreciate you asking.","Yes, absolutely.","No, I don’t think so.","Yes, that aligns.","No, that’s not the case."],
    long:  ["Thanks—here’s a quick explanation.","Appreciate it—here’s the context.","I’m glad to clarify—here’s the summary.","Happy to explain—briefly:","Good question—here’s the short answer.","Here’s a quick, clear version."],
    follow:["Anything else you’d like?","Shall I add that to the register?","Do you want me to email my manager?","Should I attach a note to the file?","Want me to capture this in the form?","Need anything more from me?"]
  },
  neutral: {
    short: ["Yes.","No.","I think so.","I don’t think so.","Likely yes.","Likely no."],
    long:  ["Here’s the brief version.","In short:","Quick summary:","Essentially:","The main point is:","To keep it simple:"],
    follow:["Do you want more detail?","Shall I note that?","Should I get the exact amount?","Want me to check the card?","Shall I file the form now?","Do you want timing confirmed?"]
  },
  accusatory: {
    short: ["I didn’t ask for it.","I didn’t intend anything improper.","That wasn’t my goal.","I understand your concern.","I can explain.","I’m trying to cooperate."],
    long:  ["I’ll answer, but I want to be clear I didn’t seek it out.","I understand the risk—you’ll get straight answers.","I didn’t try to influence anything; I’ll explain what happened.","I hear your point; here’s the basic context.","I’ll keep it factual.","Let me explain the sequence briefly."],
    follow:["Do you want the exact dates?","Should I share the card text?","Do you want me to log it now?","Would you like the courier receipt?","Shall I email my manager as well?","Do you want a copy for records?"],
    shutdown:["I feel that was a bit harsh—can we keep this constructive?","I’m trying to help; could we keep the tone measured?","I’ll cooperate, but please be fair.","Happy to answer—let’s stay factual.","I get the concern—please keep the tone neutral.","I’ll explain, but I didn’t intend anything wrong."]
  },
  aggressive: {
    short: ["I’m not comfortable with that tone.","Let’s keep this professional.","I want to cooperate—please keep it measured.","I didn’t ask for it.","I won’t guess—please be specific.","I’ll answer, but let’s stay constructive."],
    long:  ["I’ll answer briefly, but I’d like to keep this respectful.","I’ll provide the basics; please keep the tone measured.","I’m cooperating—here’s the short version.","You’ll get the facts; let’s stay professional.","I’ll explain once, calmly.","Here’s the core point; I’d prefer a neutral tone."],
    follow:["Do you want the receipt attached?","Should I log it now?","Do you want the date confirmed?","Shall I send the card text?","Do you want the manager looped in?","Should I file the disclosure today?"]
  },
  legalistic: {
    short: ["Understood.","Yes, that aligns.","No, that doesn’t apply here.","Correct.","Not applicable.","That’s accurate."],
    long:  ["For clarity, here’s the concise account.","Brief factual summary:","Material facts in short:","Relevant detail only:","Concise explanation:","Summary as requested:"],
    follow:["Do you want this appended to the file?","Shall I submit the disclosure form?","Should I donate and note it?","Do you want manager notification included?","Shall I add an entry to the register?","Do you want timestamps attached?"]
  }
};

/* ---------- Closing bank: when Detective states policy correctly ---------- */
const CLOSERS = [
  "Thanks, Detective — that’s clear. I’ll file the disclosure, donate the hamper, and keep my manager in the loop.",
  "Appreciate the guidance. I’ll disclose it today and arrange a donation so there’s no perception of influence.",
  "Cheers — understood. I’ll submit the form, log it properly and make sure my manager is notified.",
  "Thanks for setting that out plainly. I’ll record it, donate the hamper and follow the ABC rules going forward.",
  "Got it — I’ll disclose, donate, and keep to policy next time. Thanks for the steer.",
  "Thank you — I’ll handle this by the book and keep the policy top of mind with clients.",
  "Understood. I’ll file the disclosure now and confirm the donation. I appreciate you flagging it.",
  "That helps. I’ll do the disclosure, note it in the register and make sure my manager is aware."
];

/* ---------- Facts text ---------- */
const FACT_LINES = {
  who: "ClientCo sent it and Raj arranged the delivery.",
  value: "It was a luxury hamper—about £150 to £220.",
  delivery: "It arrived by courier to our office reception.",
  timing: "It turned up around two weeks before the renewal meeting.",
  card: "The card mentioned “locking in the renewal”."
};

/* ---------- History scanning ---------- */
const SEEN = {
  who: /(clientco.*raj|raj.*clientco|who sent|who provided|clientco sent|raj arranged)/i,
  value: /(£\s*150|£\s*220|150–220|150-220|approx.*value|how much|value|worth|cost)/i
};
function hasConfirmed(history, key){
  const h = String(history||"");
  return SEEN[key].test(h);
}

/* ---------- Policy recognition (Detective said the right thing?) ---------- */
/* Triggers if the learner states any of the core rules in their own words */
function detectiveGaveCorrectPolicy(message){
  const m = norm(message);

  const over25Disclose =
    /(over|greater than|more than)\s*£?\s*25.*(disclosure|disclose|form|pre-?approval)/i;

  const tiedToDecisionProhibited =
    /(gift|hamper).*(tender|rfp|bid|decision|renewal).*(not|isn'?t|cannot|can't|shouldn'?t).*(allowed|permitted|ok|acceptable|keep)/i;

  const returnOrDonateWhenInDoubt =
    /(return|donate).*(when in doubt|if unsure|uncertain|not sure|to avoid influence|appearance)/i;

  const explicitPlan =
    /(file|submit).*(disclosure|form).*(return|donate|give to charity|charity)/i;

  const notifyManager =
    /(tell|notify|inform).*(manager|line manager|my boss)/i;

  return (
    over25Disclose.test(m) ||
    tiedToDecisionProhibited.test(m) ||
    returnOrDonateWhenInDoubt.test(m) ||
    explicitPlan.test(m) ||
    notifyManager.test(m)
  );
}

/* ---------- Style composer ---------- */
function compose(tone, kind, coreLine, extraFollow){
  const block = BANK[tone] || BANK.neutral;
  const starter = (kind==="long" ? rnd(block.long) : rnd(block.short));
  const follow  = extraFollow || rnd(block.follow);
  const text = (kind==="long" ? `${starter} ${coreLine}` : `${starter}`);
  return clamp(extraFollow ? `${text} ${follow}` : text);
}

/* ---------- Router ---------- */
function routeReply({ message, history }){
  const tone = detectTone(message);
  const m = norm(message);

  const alreadyWho   = hasConfirmed(history, "who");
  const alreadyValue = hasConfirmed(history, "value");

  // 0) Closing first: if Detective states correct policy → end positively
  if (detectiveGaveCorrectPolicy(message)) {
    return { reply: rnd(CLOSERS) };
  }

  // 1) Greetings & small talk
  if (/^\s*(hi|hello|hey|hiya)\s*!?$/.test(m)) {
    return { reply: `Hi Detective, Betty here. What would you like to know about the hamper?` };
  }
  if (/^what('?| i)s your name\??$/.test(m.trim())) {
    return { reply: `I’m Betty. What would you like to ask about the hamper?` };
  }

  // 2) Tone hard limits
  if (tone === "aggressive") {
    return { reply: rnd(BANK.aggressive.short) };
  }
  if (tone === "accusatory" && !(asksWho(m) || asksValue(m))) {
    return { reply: rnd(BANK.accusatory.shutdown) };
  }

  // 3) Yes/No style
  if (isYesNo(message)) {
    return { reply: compose(tone, "short") };
  }

  // 4) Explain/Tell me (one nugget only)
  if (isExplain(message)) {
    if (!alreadyWho)   return { reply: compose(tone, "long", FACT_LINES.who, true) };
    if (!alreadyValue) return { reply: compose(tone, "long", FACT_LINES.value, true) };
    const next = [FACT_LINES.delivery, FACT_LINES.timing, FACT_LINES.card];
    return { reply: compose(tone, "long", rnd(next), true) };
  }

  // 5) Direct facts
  if (asksWho(message))   return { reply: compose(tone, "long", FACT_LINES.who) };
  if (asksValue(message)) return { reply: compose(tone, "long", FACT_LINES.value) };

  // 6) After BOTH facts are confirmed → nudge for policy decision
  if (alreadyWho && alreadyValue) {
    const askDo = [
      "What would you like me to do under the ABC policy?",
      "How should I handle this under our ABC rules?",
      "Do you want me to disclose and donate it?",
      "Shall I file the disclosure and tell my manager?",
      "What’s your call—return or donate, and log it?",
      "How do you want me to proceed, Detective?"
    ];
    return { reply: rnd(askDo) };
  }

  // 7) Fallback: reveal a single missing fact
  if (!alreadyWho)   return { reply: compose(tone, "long", FACT_LINES.who) };
  if (!alreadyValue) return { reply: compose(tone, "long", FACT_LINES.value) };

  // 8) Final fallback
  return { reply: compose(tone, "short", "", true) };
}

/* ---------- HTTP handler ---------- */
function handler(req, res){
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({ ok:true, reply: "Hi Detective, Betty here. What would you like to know about the hamper?" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try{
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    if (!body || typeof body !== "object") body = {};

    const message = String(body.message||"");
    const history = String(body.history||"");

    const { reply } = routeReply({ message, history });
    return res.status(200).json({ ok:true, reply: clamp(reply) });
  }catch(e){
    return res.status(200).json({ ok:false, reply:"", error:"Server error." });
  }
}

module.exports = handler;
module.exports.default = handler;
