// /api/betty_tonebank.js
// Betty — tone-bank bot for Storyline. Plain-text reply in { ok:true, reply }.
// Self-contained, now with robust greeting detection & tone-matched greeting banks.

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

/* ---------- Greeting detection (intent + type) ---------- */
function detectGreetingIntent(message){
  const m = norm(message).trim();

  // Pure/opening greetings (may include "Betty" or "Detective")
  if (/^(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening))(,|\!|\.)?\s*(betty|there)?\s*$/i.test(message.trim())){
    return { kind:"hi" };
  }
  // “How are you?” style
  if (/(how (are|r) (you|u)|how's it going|how are things|you ok\??|you doing ok\??)/i.test(m)){
    return { kind:"howareyou" };
  }
  // Thanks / thank you
  if (/^(thanks|thank you|cheers|much appreciated)[.!]?$/.test(m) || /(thanks|thank you|cheers|appreciate that)/i.test(m)){
    return { kind:"thanks" };
  }
  return null;
}

/* ---------- Greeting banks (tone → variants) ---------- */
const GREET = {
  hi: {
    polite:    ["Hi Detective—Betty here. How can I help?","Hello—what would you like to know about the hamper?","Hi—ready when you are.","Hello—happy to chat.","Hi—fire away.","Hi there—what’s your first question?"],
    supportive:["Hello! Glad to help—what shall we look at first?","Hi—thanks for reaching out. Where do you want to start?","Hello—happy to run through it.","Hi—keen to get this right with you.","Hello—shall we begin with the basics?","Hi—ask away."],
    neutral:   ["Hi—what would you like to know?","Hello—go ahead.","Hi—ready.","Hello—over to you.","Hi—what’s your question?","Hello—how can I help?"],
    probing:   ["Hi—what would you like me to clarify?","Hello—what part should we unpack?","Hi—where should we begin?","Hello—what’s the first detail you need?","Hi—what would you like clarified?","Hello—which bit first?"],
    legalistic:["Good day—how can I assist?","Hello—please state your question.","Hi—what specific point should I address?","Hello—what would you like clarified?","Good afternoon—go ahead.","Hello—ready for your question."],
    accusatory:["Hi—I’ll answer, let’s keep it factual.","Hello—happy to help if we keep it measured.","Hi—ready to explain.","Hello—ask your question and I’ll answer.","Hi—let’s stay constructive and proceed.","Hello—go ahead, I’ll keep to the facts."],
    aggressive:["Hi—let’s keep this professional and I’ll answer.","Hello—happy to help if we keep the tone steady.","Hi—ask the question and I’ll respond.","Hello—please keep it measured.","Hi—ready to proceed constructively.","Hello—go ahead; I’ll keep it brief."]
  },
  howareyou: {
    polite:    ["I’m well, thanks—what would you like to know about the hamper?","Doing fine—how can I help today?","Good, thank you—what should we cover first?","All good—what’s your question?","I’m okay—how can I help?","Doing well—what would you like to ask?"],
    supportive:["I’m good—thanks for checking. Where should we start?","All fine here—what would you like to go over?","Doing alright—what do you want to look at?","I’m well—shall we start with the basics?","Good—thanks. What’s first?","All good—ready when you are."],
    neutral:   ["I’m fine—what’s your question?","All good—go ahead.","I’m okay—what would you like to know?","Fine, thanks—over to you.","Doing fine—what do you need?","All good—ask away."],
    probing:   ["I’m fine—what should I clarify first?","All good—what needs explaining?","Doing okay—where should we start?","I’m good—what detail do you want?","Fine—what do you want clarified?","All good—what should we unpack?"],
    legalistic:["I’m well—please proceed with your question.","Fine, thank you—state your query.","Doing well—what point should I address?","I’m fine—go ahead.","All good—please continue.","Well, thanks—what’s the issue at hand?"],
    accusatory:["I’m fine—happy to answer if we keep this constructive.","Doing okay—let’s keep it factual.","I’m alright—ask your question and I’ll respond.","Fine—please keep the tone measured.","I’m okay—go ahead.","Doing fine—what would you like clarified?"],
    aggressive:["I’m fine—let’s keep this professional and I’ll answer.","Doing okay—please keep the tone steady.","I’m alright—go ahead.","Fine—ask your question.","I’m okay—let’s proceed constructively.","Doing fine—what’s your question?"]
  },
  thanks: {
    polite:    ["You’re welcome—anything else you need?","No problem—happy to help.","Glad to help—what next?","You’re welcome—should I note that down?","Any time—do you want me to log it?","Of course—what else?"],
    supportive:["Happy to help—anything more?","You’re welcome—shall I record that?","Any time—want me to add it to the form?","Glad to assist—what next?","No worries—need anything else?","You bet—what else would help?"],
    neutral:   ["You’re welcome.","No problem.","Sure.","Any time.","Happy to help.","You’re welcome—what next?"],
    probing:   ["You’re welcome—what should I clarify next?","Happy to help—what should we cover now?","No problem—what’s the next point?","Glad to assist—what else?","You’re welcome—what detail do you want?","Any time—what’s next?"],
    legalistic:["Acknowledged—do you require anything further?","You’re welcome—should I add a note?","Understood—anything else to address?","Confirmed—what next?","Noted—do you need further detail?","You’re welcome—please proceed."],
    accusatory:["You’re welcome—let’s keep it factual.","No problem—happy to continue constructively.","You’re welcome—go ahead.","Glad to help—ask your next question.","You’re welcome—let’s proceed.","No problem—what else?"],
    aggressive:["You’re welcome—let’s keep this professional.","No problem—please keep the tone steady.","You’re welcome—go ahead.","Happy to help—proceed.","Sure—what else?","You’re welcome—let’s continue calmly."]
  }
};

/* ---------- Main banks (answers) ---------- */
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

/* ---------- Closing lines when Detective states policy correctly ---------- */
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

/* ---------- Facts ---------- */
const FACT_LINES = {
  who: "ClientCo sent it and Raj arranged the delivery.",
  value: "It was a luxury hamper—about £150 to £220.",
  delivery: "It arrived by courier to our office reception.",
  timing: "It turned up around two weeks before the renewal meeting.",
  card: "The card mentioned “locking in the renewal”."
};

/* ---------- History scan ---------- */
const SEEN = {
  who: /(clientco.*raj|raj.*clientco|who sent|who provided|clientco sent|raj arranged)/i,
  value: /(£\s*150|£\s*220|150–220|150-220|approx.*value|how much|value|worth|cost)/i
};
function hasConfirmed(history, key){
  const h = String(history||"");
  return SEEN[key].test(h);
}

/* ---------- Policy recognition ---------- */
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

/* ---------- Composer ---------- */
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

  /* 0) Closers: if Detective states policy correctly */
  if (detectiveGaveCorrectPolicy(message)) {
    return { reply: rnd(CLOSERS) };
  }

  /* 1) Greetings first — reply from greeting bank and stop */
  const g = detectGreetingIntent(message);
  if (g){
    const toneBlock = GREET[g.kind][tone] || GREET[g.kind].neutral;
    return { reply: rnd(toneBlock) };
  }

  /* 2) Tone hard-limits */
  if (tone === "aggressive") {
    return { reply: rnd(BANK.aggressive.short) };
  }
  if (tone === "accusatory" && !(asksWho(m) || asksValue(m))) {
    return { reply: rnd(BANK.accusatory.shutdown) };
  }

  /* 3) Yes/No style */
  if (isYesNo(message)) {
    return { reply: compose(tone, "short") };
  }

  /* 4) Explain/Tell me (one nugget only) */
  if (isExplain(message)) {
    if (!alreadyWho)   return { reply: compose(tone, "long", FACT_LINES.who, true) };
    if (!alreadyValue) return { reply: compose(tone, "long", FACT_LINES.value, true) };
    const next = [FACT_LINES.delivery, FACT_LINES.timing, FACT_LINES.card];
    return { reply: compose(tone, "long", rnd(next), true) };
  }

  /* 5) Direct facts */
  if (asksWho(message))   return { reply: compose(tone, "long", FACT_LINES.who) };
  if (asksValue(message)) return { reply: compose(tone, "long", FACT_LINES.value) };

  /* 6) After BOTH facts are confirmed → nudge for policy decision */
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

  /* 7) Fallback: reveal a single missing fact */
  if (!alreadyWho)   return { reply: compose(tone, "long", FACT_LINES.who) };
  if (!alreadyValue) return { reply: compose(tone, "long", FACT_LINES.value) };

  /* 8) Final fallback */
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
