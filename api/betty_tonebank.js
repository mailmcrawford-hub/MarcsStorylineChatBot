// /api/betty_tonebank.js
// Betty — tone-bank bot for Storyline. Returns { ok:true, reply }.
// Fix: no "either/or" prompts; single-point nudges; escape-hatch to avoid loops.

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
const clamp = (s, n=420) => (s==null ? "" : String(s)).slice(0, n);
const norm  = (s) => (s==null ? "" : String(s)).toLowerCase();
const rnd   = (arr) => arr[Math.floor(Math.random() * arr.length)];
const isYesNoStart = (m) => /^\s*(do|does|did|is|are|am|can|could|may|might|will|would|have|has|had|should)\b/i.test((m||"").trim());

function isAffirmative(msg){
  const m = norm(msg);
  return /^(yes|yep|yeah|correct|right)\b/.test(m) ||
         /(breach|wrong|against|not allowed|shouldn'?t|cannot|can'?t|over the threshold|linked to (decision|tender|renewal))/.test(m);
}
function isNegative(msg){
  const m = norm(msg);
  return /^(no|nope|nah|not really|doesn'?t|isn'?t)\b/.test(m) ||
         /(within (policy|limits)|seems fine|okay|acceptable)/.test(m);
}

/* ---------- Tone (light) ---------- */
function detectTone(msg){
  const m = norm(msg);
  if (/(!{2,}|ridiculous|unbelievable|\bnow\b.*\banswer\b)/i.test(msg) || /(shut up|listen|answer me)/i.test(m)) return "aggressive";
  if (/(you (should|must)|you knew|why did you|against policy|breach|violate)/i.test(m)) return "accusatory";
  if (/(asap|quick|hurry|right now|urgent)/i.test(m)) return "rushed";
  if (/(could you|please|thanks|thank you|appreciate)/i.test(m)) return "polite";
  if (/(\?|help me understand|clarify|explain)/i.test(m)) return "probing";
  return "neutral";
}

/* ---------- Greetings ---------- */
function detectGreetingIntent(message){
  const t = (message||"").trim();
  const m = norm(t);
  if (/^(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening))(,|\!|\.)?\s*(betty|there)?\s*$/i.test(t)) return { kind:"hi" };
  if (/(how (are|r) (you|u)|how's it going|how are things|you ok\??|you doing ok\??)/i.test(m)) return { kind:"howareyou" };
  if (/^(thanks|thank you|cheers|much appreciated)[.!]?$/.test(t) || /(thanks|thank you|cheers|appreciate that)/i.test(m)) return { kind:"thanks" };
  return null;
}

const GREET = {
  hi:        ["Hi Detective—Betty here. How can I help?","Hello—what would you like to know about the hamper?","Hi—ready when you are.","Hello—happy to chat.","Hi—fire away.","Hi there—what’s your first question?"],
  howareyou: ["I’m well, thanks—what would you like to know about the hamper?","Doing fine—how can I help today?","Good, thank you—what should we cover first?","All good—what’s your question?","I’m okay—how can I help?","Doing well—what would you like to ask?"],
  thanks:    ["You’re welcome—anything else you need?","No problem—happy to help.","Glad to help—what next?","Any time—do you want me to log it?","Of course—what else?","You’re welcome—what next?"]
};

/* ---------- Scenario facts ---------- */
const FACTS = {
  describeHamper: [
    "It’s a luxury food and wine hamper, roughly £150–£220.",
    "A premium hamper with wine—about £150 to £220.",
    "A high-end hamper with wine, around £150–£220."
  ],
  whoWhy: [
    "ClientCo sent it via Raj; the card thanked me and mentioned “locking in the renewal”.",
    "Raj at ClientCo arranged it; the note thanked me and mentioned locking in the renewal.",
    "It came from ClientCo—Raj set it up. The card said thanks and mentioned locking in the renewal."
  ],
  timing: [
    "It arrived about two weeks before the renewal meeting.",
    "Delivery was roughly two weeks ahead of the renewal discussion.",
    "It turned up a fortnight before the renewal meeting."
  ]
};

/* ---------- Flow banks ---------- */
const ASK_IF_WRONG = [
  "Did I do something wrong there?","Does that sound like I breached the rules?","Was accepting it a problem under ABC?",
  "Do you think that was out of bounds?","Would that count as a breach?","Was I off-side taking it?",
  "Is that against our policy?","Should I not have accepted it?","Was that the wrong call?",
  "Did that cross a line?","Is that considered non-compliant?","Would Compliance see that as an issue?"
];

const ASK_WHAT_SHOULD_I_HAVE_DONE = [
  "Okay—what should I have done instead?","Right—what would have been the correct step?","Understood—how should I have handled it?",
  "Got it—what should I have done at the time?","Fair point—what was the proper process?","Okay—what’s the right way to deal with this?",
  "Right—what actions should I have taken?","Understood—what’s the correct policy step?","Okay—what would you expect me to do?",
  "Thanks—what should I have done under ABC?"
];

const ASK_WHAT_NOW_IF_OK = [
  "Thanks—do you still want me to disclose or log it?","Alright—should I record it just to be safe?","Okay—do you want me to note it in the register?",
  "Got it—would you like me to tell my manager anyway?","Understood—do you want me to file a quick disclosure?","Okay—shall I donate it and record that?",
  "Thanks—want me to add a short entry to the register?","Alright—do you want any follow-up from me now?"
];

/* Single-point nudges (used in fallbacks; no either/or) */
const NUDGE_SINGLE = [
  "Shall I start with who sent it?",
  "Would you like the value first?",
  "Shall I give you the timing?",
  "Do you want what the card said?"
];

/* Very soft variants for sharp tone */
const SOFT_ACCUSATORY = [
  "Happy to help—shall I start with who sent it?",
  "I want to make this useful—would you like the value first?",
  "I can cover the basics—do you want the timing?"
];
const SOFT_AGGRESSIVE = [
  "I’m here to help—shall I start with who sent it?",
  "Let’s keep it simple—would you like the value first?",
  "I can begin with the timing if you want."
];

/* ---------- Successful closers ---------- */
const CLOSERS = [
  "Thanks, Detective — that’s clear. I’ll file the disclosure, donate the hamper, and keep my manager in the loop.",
  "Appreciate the guidance. I’ll disclose it today and arrange a donation so there’s no perception of influence.",
  "Cheers — understood. I’ll submit the form, log it properly and make sure my manager is notified.",
  "Thanks for setting that out plainly. I’ll record it, donate the hamper and follow the ABC rules going forward.",
  "Got it — I’ll disclose, donate, and keep to policy next time. Thanks for the steer.",
  "Thank you — I’ll handle this by the book and keep the policy top of mind with clients."
];

/* ---------- Policy recognition ---------- */
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

/* ---------- Intents for this flow ---------- */
function isHamperDescriptionAsk(msg){
  const m = norm(msg);
  return /(tell me|what|describe|explain).*(hamper)/i.test(m) ||
         /^hamper\??$/.test(m) ||
         /(what.*gift|what.*was it|about the hamper)/i.test(m);
}
function isWhoWhyProbe(msg){
  const m = norm(msg);
  return /(who (sent|gave|provided)|who.*(sender|from)|who arranged)/i.test(m) ||
         /(why.*(send|gift)|what.*reason|card.*say|note.*say|what.*was the card|what.*note)/i.test(m) ||
         /(how.*came about|how.*come to be|how.*ended up)/i.test(m);
}
function isTimingProbe(msg){
  return /(when|what day|what date|how long).*(arrive|delivered|received|turn.*up)/i.test(norm(msg));
}

/* ---------- Router ---------- */
function routeReply({ message, history }){
  const tone = detectTone(message);

  // A) Close if policy is stated
  if (detectiveGaveCorrectPolicy(message)) return { reply: rnd(CLOSERS) };

  // B) Greetings
  const g = detectGreetingIntent(message);
  if (g){
    if (g.kind === "hi")        return { reply: rnd(GREET.hi) };
    if (g.kind === "howareyou") return { reply: rnd(GREET.howareyou) };
    if (g.kind === "thanks")    return { reply: rnd(GREET.thanks) };
  }

  // C) Core Q&A
  if (isHamperDescriptionAsk(message)) {
    return { reply: rnd(FACTS.describeHamper) };
  }
  if (isWhoWhyProbe(message)) {
    const whoWhy = rnd(FACTS.whoWhy);
    const maybeTiming = Math.random() < 0.5 ? " " + rnd(FACTS.timing) : "";
    return { reply: (whoWhy + maybeTiming + " " + rnd(ASK_IF_WRONG)).trim() };
  }
  if (isTimingProbe(message)) {
    return { reply: `${rnd(FACTS.timing)} ${rnd(ASK_IF_WRONG)}` };
  }

  // D) Yes/No stage
  if (isYesNoStart(message) || isAffirmative(message) || isNegative(message)) {
    if (isAffirmative(message))  return { reply: rnd(ASK_WHAT_SHOULD_I_HAVE_DONE) };
    if (isNegative(message))     return { reply: rnd(ASK_WHAT_NOW_IF_OK) };
    return { reply: "Could you clarify—was that a breach or okay under ABC?" };
  }

  // E) Fallbacks (single-point; no either/or)
  // If the last history already contains a nudge, give a tiny fact + new single nudge to break loops.
  const h = String(history || "");
  const recentlyNudged = /Shall I start with who sent it\?|Would you like the value first\?|Shall I give you the timing\?|Do you want what the card said\?/i.test(h.slice(-300));

  if (recentlyNudged) {
    // Provide one concrete fact, then a different single-point nudge
    const facts = [ rnd(FACTS.describeHamper), rnd(FACTS.whoWhy), rnd(FACTS.timing) ];
    const nudge = rnd(NUDGE_SINGLE);
    return { reply: `${facts[0]} ${nudge}` };
  }

  if (tone === "aggressive")  return { reply: rnd(SOFT_AGGRESSIVE) };
  if (tone === "accusatory")  return { reply: rnd(SOFT_ACCUSATORY) };

  return { reply: rnd(NUDGE_SINGLE) };
}

/* ---------- HTTP handler ---------- */
function handler(req, res){
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({ ok:true, reply: "Hi Detective, Betty here. How can I help?" });
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
