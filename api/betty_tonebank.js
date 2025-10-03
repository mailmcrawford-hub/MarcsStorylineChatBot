// /api/betty_tonebank.js
// Betty — conversation flow tuned to your spec.
// Flow:
// 1) Detective greets → Betty greets & asks how she can help
// 2) Detective asks open "tell/explain about the hamper" → Betty describes WHAT + VALUE, then gently asks if something is wrong
// 3) If Detective asks WHO gave it → Betty answers WHO/WHY (+ timing) and asks if something is wrong
// 4) Detective response:
//    - If it references policy → Betty acknowledges breach/lesson and closes positively
//    - If affirmative/critical but no policy → Betty asks "What should I have done?"
//    - If negative/unsure → Betty asks for clarity or what to do now (log/disclose)
// 5) If still no policy stated → Betty loops once with a clear nudge, not a hard repeat (no stuck loops)

"use strict";

/* ----------------- CORS ----------------- */
function setCORS(res){
  try{
    res.setHeader("Access-Control-Allow-Origin","*");
    res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers","Content-Type, Accept");
  }catch{}
}

/* ----------------- Utils ---------------- */
const clamp = (s, n=420) => (s==null ? "" : String(s)).slice(0, n);
const norm  = (s) => (s==null ? "" : String(s)).toLowerCase();
const rnd   = (arr) => arr[Math.floor(Math.random() * arr.length)];
const isYesNoStart = (m) => /^\s*(do|does|did|is|are|am|can|could|may|might|will|would|have|has|had|should)\b/i.test((m||"").trim());

function isAffirmative(msg){
  const m = norm(msg);
  return /^(yes|yep|yeah|correct|right|it is|it was)\b/.test(m) ||
         /(breach|wrong|against|not allowed|shouldn'?t|cannot|can'?t|over the threshold|linked to (decision|tender|renewal))/i.test(m);
}
function isNegative(msg){
  const m = norm(msg);
  return /^(no|nope|nah|not really|doesn'?t|isn'?t|fine|ok(ay)?)\b/.test(m) ||
         /(within (policy|limits)|seems fine|acceptable)/i.test(m);
}

/* ----------------- Tone (light) ---------------- */
function detectTone(msg){
  const m = norm(msg);
  if (/(!{2,}|ridiculous|unbelievable|\bnow\b.*\banswer\b)/i.test(msg) || /(shut up|listen|answer me)/i.test(m)) return "aggressive";
  if (/(you (should|must)|you knew|why did you|against policy|breach|violate)/i.test(m)) return "accusatory";
  if (/(asap|quick|hurry|right now|urgent)/i.test(m)) return "rushed";
  if (/(could you|please|thanks|thank you|appreciate)/i.test(m)) return "polite";
  if (/(\?|help me understand|clarify|explain)/i.test(m)) return "probing";
  return "neutral";
}

/* ----------------- Greetings ---------------- */
function detectGreetingIntent(message){
  const t = (message||"").trim();
  const m = norm(t);
  if (/^(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening))(,|\!|\.)?\s*(betty|there)?\s*$/i.test(t)) return { kind:"hi" };
  if (/(how (are|r) (you|u)|how's it going|how are things|you ok\??|you doing ok\??)/i.test(m)) return { kind:"howareyou" };
  if (/^(thanks|thank you|cheers|much appreciated)[.!]?$/.test(t) || /(thanks|thank you|cheers|appreciate that)/i.test(m)) return { kind:"thanks" };
  return null;
}

const GREET = {
  hi: [
    "Hi Detective—Betty here. How can I help?",
    "Hello—what would you like to know about the hamper?",
    "Hi—ready when you are.",
    "Hello—happy to chat.",
    "Hi—fire away."
  ],
  howareyou: [
    "I’m well, thanks—what would you like to know about the hamper?",
    "Doing fine—how can I help today?",
    "Good, thank you—what should we cover first?",
    "All good—what’s your question?"
  ],
  thanks: [
    "You’re welcome—anything else you need?",
    "No problem—happy to help.",
    "Glad to help—what next?"
  ]
};

/* ----------------- Scenario facts (what/value, who/why, timing) ---------------- */
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

/* ----------------- Banks for the flow ---------------- */
const ASK_IF_WRONG = [
  "Did I do something wrong there?",
  "Does that sound like I breached the rules?",
  "Was accepting it a problem under ABC?",
  "Would that count as a breach?",
  "Is that against our policy?",
  "Should I not have accepted it?",
  "Was that the wrong call?",
  "Did that cross a line?",
  "Would Compliance see that as an issue?"
];

const ASK_WHAT_SHOULD_I_HAVE_DONE = [
  "Okay—what should I have done instead?",
  "Right—what would have been the correct step?",
  "Understood—how should I have handled it?",
  "Got it—what should I have done at the time?",
  "Fair point—what was the proper process?",
  "Okay—what’s the right way to deal with this?"
];

const ASK_FOR_CLARITY = [
  "Could you say which part conflicts with ABC?",
  "Which rule does this touch—value, timing, or intent?",
  "What’s the policy concern—over the threshold, tied to a decision, or something else?",
  "Is the issue the timing, the value, or the note on the card?"
];

const ASK_WHAT_NOW_IF_OK = [
  "Do you still want me to disclose or log it?",
  "Should I record it just to be safe?",
  "Do you want me to note it in the register?",
  "Shall I tell my manager anyway?"
];

/* Single-point nudges (fallbacks) */
const NUDGE_SINGLE = [
  "Shall I start with who sent it?",
  "Would you like the value first?",
  "Shall I give you the timing?",
  "Do you want what the card said?"
];

/* Positive, policy-aware closers (when Detective states the rule) */
const CLOSERS = [
  "Thanks, Detective — that’s clear. I’ll file the disclosure, donate the hamper, and keep my manager in the loop.",
  "Appreciate the guidance. I’ll disclose it today and arrange a donation so there’s no perception of influence.",
  "Cheers — understood. I’ll submit the form, log it properly and make sure my manager is notified.",
  "Thanks for setting that out plainly. I’ll record it, donate the hamper and follow the ABC rules going forward."
];

/* ----------------- Policy recognition (for close) ---------------- */
function detectiveGaveCorrectPolicy(message){
  const m = norm(message);
  const over25Disclose = /(over|greater than|more than)\s*£?\s*25.*(disclosure|disclose|form|pre-?approval)/i;
  const tiedToDecisionProhibited = /(gift|hamper).*(tender|rfp|bid|decision|renewal).*(not|isn'?t|cannot|can't|shouldn'?t).*(allowed|permitted|ok|acceptable|keep)/i;
  const returnOrDonateWhenInDoubt = /(return|donate).*(when in doubt|if unsure|uncertain|not sure|to avoid influence|appearance)/i;
  const explicitPlan = /(file|submit).*(disclosure|form).*(return|donate|give to charity|charity)/i;
  const notifyManager = /(tell|notify|inform).*(manager|line manager|my boss)/i;

  return (
    over25Disclose.test(m) ||
    tiedToDecisionProhibited.test(m) ||
    returnOrDonateWhenInDoubt.test(m) ||
    explicitPlan.test(m) ||
    notifyManager.test(m)
  );
}

/* ----------------- Intent detectors to fit your script ---------------- */
function isOpenDescribeAsk(msg){
  // “tell me about / explain … hamper”
  const m = norm(msg);
  return /(tell me|explain).*(hamper)/i.test(m);
}
function isShortHamperAsk(msg){
  const m = norm(msg);
  return /(hamper\??|about the hamper|what.*was it|what.*gift)/i.test(m);
}
function isWhoAsk(msg){
  const m = norm(msg);
  return /(who (sent|gave|provided)|who.*(sender|from)|who arranged)/i.test(m);
}
function isWhyOrCardAsk(msg){
  const m = norm(msg);
  return /(why.*(send|gift)|what.*reason|card.*say|note.*say)/i.test(m);
}
function isTimingAsk(msg){
  const m = norm(msg);
  return /(when|what day|what date|how long).*(arrive|delivered|received|turn.*up)/i.test(m);
}

/* ----------------- Stage detection from history (light) ---------------- */
function stageFromHistory(historyText){
  const h = norm(historyText||"");
  const saidDescribe = /(luxury.*hamper|premium hamper|high-end hamper)/i.test(historyText||"");
  const saidWhoWhy   = /(clientco.*raj|raj.*clientco|locking in the renewal)/i.test(historyText||"");
  const askedWrong   = /(did i do something wrong|breached the rules|problem under abc|wrong call|against our policy|cross a line|should i not have accepted)/i.test(h);
  const askedWhatDo  = /(what should i have done|correct step|how should i have handled|proper process|right way to deal)/i.test(h);
  const nudgedOnce   = /(shall i start with who sent it\?|would you like the value first\?|shall i give you the timing\?|do you want what the card said\?)/i.test(h);
  return { saidDescribe, saidWhoWhy, askedWrong, askedWhatDo, nudgedOnce };
}

/* ----------------- Router ---------------- */
function routeReply({ message, history }){
  // 0) Immediate close if Detective states policy correctly
  if (detectiveGaveCorrectPolicy(message)) {
    return { reply: rnd(CLOSERS) };
  }

  const stage = stageFromHistory(history||"");

  // 1) Greetings
  const g = detectGreetingIntent(message);
  if (g){
    if (g.kind === "hi")        return { reply: rnd(GREET.hi) };
    if (g.kind === "howareyou") return { reply: rnd(GREET.howareyou) };
    if (g.kind === "thanks")    return { reply: rnd(GREET.thanks) };
  }

  // 2) Open “tell/explain about the hamper” -> WHAT + VALUE + ask if wrong
  if (isOpenDescribeAsk(message)) {
    const line = rnd(FACTS.describeHamper);
    return { reply: `${line} ${rnd(ASK_IF_WRONG)}` };
  }

  // 3) Short mention “hamper?” -> brief WHAT (+ optional value) then ask if wrong
  if (isShortHamperAsk(message) && !stage.saidDescribe) {
    const line = rnd(FACTS.describeHamper);
    return { reply: `${line} ${rnd(ASK_IF_WRONG)}` };
  }

  // 4) WHO / WHY / CARD / TIMING -> answer then ask if wrong (once)
  if (isWhoAsk(message) || isWhyOrCardAsk(message) || isTimingAsk(message) || (stage.saidDescribe && !stage.saidWhoWhy)) {
    const bits = [ rnd(FACTS.whoWhy) ];
    if (Math.random() < 0.5) bits.push(rnd(FACTS.timing));
    const ask = stage.askedWrong ? "" : " " + rnd(ASK_IF_WRONG);
    return { reply: `${bits.join(" ")}${ask}`.trim() };
  }

  // 5) Detective’s response after “Did I do something wrong?”
  if (stage.askedWrong && (isYesNoStart(message) || isAffirmative(message) || isNegative(message))) {
    if (detectiveGaveCorrectPolicy(message)) {
      return { reply: rnd(CLOSERS) };
    }
    if (isAffirmative(message)) {
      return { reply: rnd(ASK_WHAT_SHOULD_I_HAVE_DONE) };
    }
    if (isNegative(message)) {
      return { reply: rnd(ASK_WHAT_NOW_IF_OK) };
    }
    return { reply: rnd(ASK_FOR_CLARITY) };
  }

  // 6) If we already asked “what should I have done?”, we’re waiting for a policy statement → nudge clearly
  if (stage.askedWhatDo) {
    return { reply: "What does ABC require here—disclose anything over £25, avoid gifts tied to a decision, then return or donate and notify your manager?" };
  }

  // 7) Forward-driving nudges if conversation is off-track:
  if (!stage.saidDescribe) return { reply: `${rnd(FACTS.describeHamper)} ${rnd(ASK_IF_WRONG)}` };
  if (!stage.saidWhoWhy)   return { reply: `${rnd(FACTS.whoWhy)} ${rnd(ASK_IF_WRONG)}` };
  if (!stage.askedWrong)   return { reply: rnd(ASK_IF_WRONG) };

  // 8) Final fallback: single, purposeful nudge
  if (!stage.nudgedOnce) return { reply: rnd(NUDGE_SINGLE) };
  return { reply: rnd(ASK_FOR_CLARITY) };
}

/* ----------------- HTTP handler ---------------- */
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
