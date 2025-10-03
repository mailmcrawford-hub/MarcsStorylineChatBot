// /api/betty_tonebank.js
// Betty — tone-bank bot for Storyline. Returns { ok:true, reply }.
// Expanded intents so Betty answers more kinds of questions directly.

"use strict";

/* ---------- CORS ---------- */
function setCORS(res){
  try{
    res.setHeader("Access-Control-Allow-Origin","*");
    res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers","Content-Type, Accept");
  }catch{}
}

/* ---------- Utils ---------- */
const clamp = (s, n=400) => (s==null ? "" : String(s)).slice(0, n);
const norm  = (s) => (s==null ? "" : String(s)).toLowerCase();
const rnd   = (arr) => arr[Math.floor(Math.random() * arr.length)];

const isYesNo   = (m) => /^\s*(do|does|did|is|are|am|can|could|may|might|will|would|have|has|had|should)\b/i.test(m.trim());
const isExplain = (m) => /(tell me|walk me|talk me|explain|run me through|describe)/i.test(m);
const asksWho   = (m) => /(who (sent|provided)|who.*(from|sender)|where.*came from|who gave)/i.test(m);
const asksValue = (m) => /(how much|value|worth|price|cost|approx(imate)? value|roughly)/i.test(m);

/* ---------- Tone detection ---------- */
function detectTone(msg){
  const m = norm(msg);
  if (/(!{2,}|you lied|obviously|ridiculous|unbelievable|\bnow\b.*\banswer\b)/i.test(msg) || /(shut up|listen|answer me)/i.test(m)) return "aggressive";
  if (/(you (should|must)|you knew|you realised|against policy|breach|violate|why did you)/i.test(m)) return "accusatory";
  if (/(section \d|per policy|as per|threshold|sub clause|pursuant|hereby|therefore)/i.test(m)) return "legalistic";
  if (/(asap|quick|hurry|fast|right now|urgent)/i.test(m)) return "rushed";
  if (/(could you|please|thanks|thank you|appreciate)/i.test(m)) return "polite";
  if (/(\?|help me understand|what happened|can you clarify)/i.test(m)) return "probing";
  return "neutral";
}

/* ---------- Greetings ---------- */
function detectGreetingIntent(message){
  const t = message.trim();
  const m = norm(t);
  if (/^(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening))(,|\!|\.)?\s*(betty|there)?\s*$/i.test(t)) return { kind:"hi" };
  if (/(how (are|r) (you|u)|how's it going|how are things|you ok\??|you doing ok\??)/i.test(m)) return { kind:"howareyou" };
  if (/^(thanks|thank you|cheers|much appreciated)[.!]?$/.test(t) || /(thanks|thank you|cheers|appreciate that)/i.test(m)) return { kind:"thanks" };
  return null;
}

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
    neutral:   ["I’m fine—what’s your question?","All good—go ahead.","I’m okay—what would you like to know?","Fine, thanks—over to you.","Doing fine—what do you need?","All good—ask away."]
  },
  thanks: {
    polite:    ["You’re welcome—anything else you need?","No problem—happy to help.","Glad to help—what next?","You’re welcome—should I note that down?","Any time—do you want me to log it?","Of course—what else?"],
    supportive:["Happy to help—anything more?","You’re welcome—shall I record that?","Any time—want me to add it to the form?","Glad to assist—what next?","No worries—need anything else?","You bet—what else would help?"],
    neutral:   ["You’re welcome.","No problem.","Sure.","Any time.","Happy to help.","You’re welcome—what next?"]
  }
};

/* ---------- Short yes/no (no prefixes) ---------- */
const YESNO = {
  polite:    ["Yes.","No.","I believe so.","I don’t think so.","Likely yes.","Probably not."],
  probing:   ["Yes.","No.","Yes, within reason.","No, not here.","Seems so.","Doesn’t look like it."],
  supportive:["Yes—thanks for checking.","No—good call to ask.","Yes, that fits.","No, not this time.","Yes, that aligns.","No, I wouldn’t say so."],
  neutral:   ["Yes.","No.","Think so.","Don’t think so.","Probably.","Probably not."],
  legalistic:["Affirmative.","Negative.","Correct.","Incorrect.","Applicable.","Not applicable."],
  accusatory:["Yes—happy to clarify.","No—that’s not right.","Yes, but I can explain.","No, and I can explain.","Yes, if needed.","No, not in my case."],
  aggressive:["Yes.","No.","If we keep this professional—yes.","No—please keep it measured.","Yes, but calmly.","No."]
};

/* ---------- Policy closers ---------- */
const CLOSERS = [
  "Thanks, Detective — that’s clear. I’ll file the disclosure, donate the hamper, and keep my manager in the loop.",
  "Appreciate the guidance. I’ll disclose it today and arrange a donation so there’s no perception of influence.",
  "Cheers — understood. I’ll submit the form, log it properly and make sure my manager is notified.",
  "Thanks for setting that out plainly. I’ll record it, donate the hamper and follow the ABC rules going forward.",
  "Got it — I’ll disclose, donate, and keep to policy next time. Thanks for the steer.",
  "Thank you — I’ll handle this by the book and keep the policy top of mind with clients."
];

/* ---------- Facts and follow-ups ---------- */
const FACT_LINES = {
  who: "ClientCo sent it and Raj arranged the delivery.",
  value: "It was a luxury hamper—about £150 to £220.",
  delivery: "It arrived by courier to our office reception.",
  timing: "It turned up around two weeks before the renewal meeting.",
  card: "The card mentioned “locking in the renewal”.",
  undisclosed: "I haven’t submitted the disclosure yet."
};

const FOLLOWUP = {
  general:    ["Do you want me to file the disclosure now?","Should I log it in the register?","Return or donate it—what’s your call?","Shall I notify my manager as well?","Do you want the card text attached to the record?"],
  afterWho:   ["Do you want Raj and ClientCo named on the disclosure?","Shall I include their details on the form?"],
  afterValue: ["Given the value, should I disclose and donate?","Do you want me to log that amount and donate it?"],
  afterTiming:["As the timing links to the renewal, should I disclose and donate?","Do you want me to note the timing and file the form?"],
  afterCard:  ["With that wording, should I attach the card and file disclosure?","Do you want the card text added to the record?"],
  afterDelivery:["Shall I add the courier/reception detail to the form?","Do you want the delivery method recorded?"],
  afterApproval:["Shall I submit the disclosure today?","Do you want me to complete the form now?"],
  afterProcess:["Do you want me to start the disclosure and notify my manager?","Should I log it and donate it?"],
  afterRegister:["Shall I add an entry to the register now?","Do you want me to record it today?"],
  afterManager:["Do you want me to notify my manager right away?","Shall I copy them on the disclosure?"],
  afterKeep:  ["Would you prefer return or donation?","Shall I donate it to avoid any perception of influence?"],
  afterInfluence:["Do you want me to disclose and donate to avoid any appearance?","Should I record it formally and donate it?"],
  afterHospitality:["Do you want me to file disclosure since this wasn’t pre-approved hospitality?","Shall I record it and donate?"],
  afterOfficials:["Do you want me to disclose and donate, given public-official rules?","Should I record it and avoid any gift here?"],
  afterThreshold:["Even if it’s under £25, do you want me to log it to be safe?","Shall I check approval and record it?"]
};

/* ---------- History scan ---------- */
const SEEN = {
  who: /(clientco.*raj|raj.*clientco|who sent|who provided|clientco sent|raj arranged)/i,
  value: /(£\s*150|£\s*220|150–220|150-220|approx.*value|how much|value|worth|cost)/i
};
const hasConfirmed = (history, key) => SEEN[key].test(String(history||""));

/* ---------- Policy recognition (learner states it) ---------- */
function detectiveGaveCorrectPolicy(message){
  const m = norm(message);
  const over25Disclose = /(over|greater than|more than)\s*£?\s*25.*(disclosure|disclose|form|pre-?approval)/i;
  const tiedToDecisionProhibited = /(gift|hamper).*(tender|rfp|bid|decision|renewal).*(not|isn'?t|cannot|can't|shouldn'?t).*(allowed|permitted|ok|acceptable|keep)/i;
  const returnOrDonateWhenInDoubt = /(return|donate).*(when in doubt|if unsure|uncertain|not sure|to avoid influence|appearance)/i;
  const explicitPlan = /(file|submit).*(disclosure|form).*(return|donate|give to charity|charity)/i;
  const notifyManager = /(tell|notify|inform).*(manager|line manager|my boss)/i;
  return over25Disclose.test(m) || tiedToDecisionProhibited.test(m) ||
         returnOrDonateWhenInDoubt.test(m) || explicitPlan.test(m) || notifyManager.test(m);
}

/* ---------- Helpers ---------- */
const follow = (key) => rnd(FOLLOWUP[key] || FOLLOWUP.general);

/* ---------- INTENTS (new coverage) ---------- */
function matchIntent(msg){
  const m = norm(msg);

  if (/(when|what day|what date|how long).*(arrive|came|delivered|received)/i.test(m))
    return { key:"timing", line: FACT_LINES.timing, fk:"afterTiming" };

  if (/(how|who).*(deliver|delivered|delivery|courier|reception)/i.test(m))
    return { key:"delivery", line: FACT_LINES.delivery, fk:"afterDelivery" };

  if (/(card|note|message).*(say|mention|word|text)/i.test(m))
    return { key:"card", line: FACT_LINES.card, fk:"afterCard" };

  if (/(did you (log|disclose|submit|file)|is it (logged|disclosed)|approval|approved)/i.test(m))
    return { key:"approval", line: FACT_LINES.undisclosed, fk:"afterApproval" };

  if (/(how (do|to)|what('s| is) the process|where.*form|how.*disclose|step.*disclosure)/i.test(m))
    return { key:"process", line:"I use the disclosure form, then return or donate, and notify my manager.", fk:"afterProcess" };

  if (/(register|log it|record it|books|records)/i.test(m))
    return { key:"register", line:"I can add an entry to the gifts & hospitality register.", fk:"afterRegister" };

  if (/(tell|notify|inform).*(manager|boss|line manager)/i.test(m))
    return { key:"manager", line:"I can notify my manager as part of the process.", fk:"afterManager" };

  if (/(keep|accept|hold onto|hang on to).*(gift|hamper|wine)/i.test(m))
    return { key:"keep", line:"Given the timing and value, I shouldn’t keep it.", fk:"afterKeep" };

  if (/(did it|would it|could it).*(influence|sway|affect|bias)/i.test(m))
    return { key:"influence", line:"I didn’t ask for it and it didn’t change my decisions, but I see the perception risk.", fk:"afterInfluence" };

  if (/(same|like).*(dinner|meal|hospitality|event)/i.test(m))
    return { key:"hospitality", line:"Dinners can be pre-approved hospitality; this was an unsolicited gift.", fk:"afterHospitality" };

  if (/(public\s*official|mayor|council|soe|state[-\s]*owned)/i.test(m))
    return { key:"officials", line:"With public officials we only allow small promo items; a hamper wouldn’t be appropriate.", fk:"afterOfficials" };

  if (/(under|less than|below)\s*£?\s*25/.test(m))
    return { key:"threshold", line:"Under £25 can be acceptable with care, but this was higher and near a decision.", fk:"afterThreshold" };

  return null;
}

/* ---------- Router ---------- */
function routeReply({ message, history }){
  const tone = detectTone(message);
  const m = norm(message);
  const alreadyWho   = hasConfirmed(history, "who");
  const alreadyValue = hasConfirmed(history, "value");

  // 0) Close if learner states policy correctly
  if (detectiveGaveCorrectPolicy(message)) return { reply: rnd(CLOSERS) };

  // 1) Greetings
  const g = detectGreetingIntent(message);
  if (g){
    const toneBlock = (GREET[g.kind] && (GREET[g.kind][tone] || GREET[g.kind].neutral)) || ["Hello—how can I help?"];
    return { reply: rnd(toneBlock) };
  }

  // 2) Tone hard-limits
  if (tone === "aggressive") return { reply: "Let’s keep this professional and I’ll answer." };
  if (tone === "accusatory" && !(asksWho(m) || asksValue(m))) return { reply: "I’ll cooperate—let’s keep it factual and measured." };

  // 3) Yes/No
  if (isYesNo(message)) {
    const set = YESNO[tone] || YESNO.neutral;
    return { reply: rnd(set) };
  }

  // 4) Expanded intents
  const it = matchIntent(message);
  if (it) return { reply: `${it.line} ${follow(it.fk)}` };

  // 5) Explain/Tell me (one nugget + follow-up)
  if (isExplain(message)) {
    if (!alreadyWho)   return { reply: `${FACT_LINES.who} ${follow("afterWho")}` };
    if (!alreadyValue) return { reply: `${FACT_LINES.value} ${follow("afterValue")}` };
    // then next small fact
    const nexts = [
      ["afterDelivery", FACT_LINES.delivery],
      ["afterTiming",   FACT_LINES.timing],
      ["afterCard",     FACT_LINES.card]
    ];
    const [fk, line] = rnd(nexts);
    return { reply: `${line} ${follow(fk)}` };
  }

  // 6) Direct who/value
  if (asksWho(message))   return { reply: `${FACT_LINES.who} ${follow("afterWho")}` };
  if (asksValue(message)) return { reply: `${FACT_LINES.value} ${follow("afterValue")}` };

  // 7) If both facts known → nudge to policy decision
  if (alreadyWho && alreadyValue) {
    const nudges = [
      "How should I handle this under the ABC policy—disclose and donate?",
      "Do you want me to file the disclosure and notify my manager?",
      "Shall I log it in the register and donate the hamper?",
      "What’s your call—return or donate, and record it?",
      "Should I submit the form now and keep my manager in the loop?",
      "What would you like me to do next under ABC?"
    ];
    return { reply: rnd(nudges) };
  }

  // 8) Fallback: reveal one missing fact with a sensible follow-up
  if (!alreadyWho)   return { reply: `${FACT_LINES.who} ${follow("afterWho")}` };
  if (!alreadyValue) return { reply: `${FACT_LINES.value} ${follow("afterValue")}` };

  // 9) Final nudge
  return { reply: rnd(FOLLOWUP.general) };
}

/* ---------- HTTP handler ---------- */
function handler(req, res){
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET")
    return res.status(200).json({ ok:true, reply: "Hi Detective, Betty here. How can I help?" });

  if (req.method !== "POST")
    return res.status(405).json({ ok:false, error:"Method not allowed" });

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
