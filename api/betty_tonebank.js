// /api/betty_tonebank.js
// Betty — tone-bank bot for Storyline. Returns { ok:true, reply }.
// Conversation flow you requested: greet → describe hamper → probe who/why → “did I do wrong?” → yes/no → “what should I have done?” → policy close.

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

/* Small helpers */
const isYesNoStart = (m) => /^\s*(do|does|did|is|are|am|can|could|may|might|will|would|have|has|had|should)\b/i.test(m.trim());
const contains = (re, s) => re.test(norm(s||""));

/* Affirmative/negative detectors for the Detective’s answer */
function isAffirmative(msg){
  const m = norm(msg);
  return /^(yes|yep|yeah|correct|right|it is|it was|that’s (true|right)|agreed)\b/.test(m) ||
         /(breach|wrong|against|not allowed|shouldn'?t|cannot|can'?t|over the threshold|linked to (decision|tender|renewal))/.test(m);
}
function isNegative(msg){
  const m = norm(msg);
  return /^(no|nope|nah|not really|doesn'?t|isn'?t|it (isn'?t|wasn'?t)|that’s fine|ok)\b/.test(m) ||
         /(within (policy|limits)|seems fine|okay|acceptable)/.test(m);
}

/* ----------------- Tones (lightweight) ---------------- */
function detectTone(msg){
  const m = norm(msg);
  if (/(!{2,}|ridiculous|unbelievable|\bnow\b.*\banswer\b)/i.test(msg) || /(shut up|listen|answer me)/i.test(m)) return "aggressive";
  if (/(you (should|must)|you knew|why did you|against policy|breach|violate)/i.test(m)) return "accusatory";
  if (/(asap|quick|hurry|right now|urgent)/i.test(m)) return "rushed";
  if (/(could you|please|thanks|thank you|appreciate)/i.test(m)) return "polite";
  if (/(\?|help me understand|clarify|explain)/i.test(m)) return "probing";
  return "neutral";
}

/* ----------------- Greeting detection ---------------- */
function detectGreetingIntent(message){
  const t = message.trim();
  const m = norm(t);
  if (/^(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening))(,|\!|\.)?\s*(betty|there)?\s*$/i.test(t)) return { kind:"hi" };
  if (/(how (are|r) (you|u)|how's it going|how are things|you ok\??|you doing ok\??)/i.test(m)) return { kind:"howareyou" };
  if (/^(thanks|thank you|cheers|much appreciated)[.!]?$/.test(t) || /(thanks|thank you|cheers|appreciate that)/i.test(m)) return { kind:"thanks" };
  return null;
}

/* Tone-matched greeting banks (short & friendly) */
const GREET = {
  hi:        ["Hi Detective—Betty here. How can I help?","Hello—what would you like to know about the hamper?","Hi—ready when you are.","Hello—happy to chat.","Hi—fire away.","Hi there—what’s your first question?"],
  howareyou: ["I’m well, thanks—what would you like to know about the hamper?","Doing fine—how can I help today?","Good, thank you—what should we cover first?","All good—what’s your question?","I’m okay—how can I help?","Doing well—what would you like to ask?"],
  thanks:    ["You’re welcome—anything else you need?","No problem—happy to help.","Glad to help—what next?","Any time—do you want me to log it?","Of course—what else?","You’re welcome—what next?"]
};

/* ----------------- Core scenario facts ---------------- */
const FACTS = {
  describeHamper: [
    "It’s a luxury food and wine hamper, roughly £150–£220.",
    "A premium hamper with wine—somewhere around £150 to £220.",
    "A high-end hamper with wine, about £150–£220."
  ],
  whoWhy: [
    "ClientCo sent it via Raj; the card thanked me and mentioned “locking in the renewal”.",
    "Raj at ClientCo arranged it; the note thanked me and talked about locking in the renewal.",
    "It came from ClientCo—Raj set it up. The card said thanks and mentioned locking in the renewal."
  ],
  timing: [
    "It arrived about two weeks before the renewal meeting.",
    "Delivery was roughly two weeks ahead of the renewal discussion.",
    "It turned up a fortnight before the renewal meeting."
  ]
};

/* ----------------- Banks for your required flow ---------------- */

/* After who/why, Betty asks if she did wrong (choose one) */
const ASK_IF_WRONG = [
  "Did I do something wrong there?",
  "Does that sound like I breached the rules?",
  "Was accepting it a problem under ABC?",
  "Do you think that was out of bounds?",
  "Would that count as a breach?",
  "Was I off-side taking it?",
  "Is that against our policy?",
  "Should I not have accepted it?",
  "Was that the wrong call?",
  "Did that cross a line?",
  "Is that considered non-compliant?",
  "Would Compliance see that as an issue?"
];

/* If the Detective says YES/it was wrong → ask what she should have done */
const ASK_WHAT_SHOULD_I_HAVE_DONE = [
  "Okay—what should I have done instead?",
  "Right—what would have been the correct step?",
  "Understood—how should I have handled it?",
  "Got it—what should I have done at the time?",
  "Fair point—what was the proper process?",
  "Okay—what’s the right way to deal with this?",
  "Right—what actions should I have taken?",
  "Understood—what’s the correct policy step?",
  "Okay—what would you expect me to do?",
  "Thanks—what should I have done under ABC?"
];

/* If the Detective says NO/it’s fine → ask what to do now (light nudge) */
const ASK_WHAT_NOW_IF_OK = [
  "Thanks—do you still want me to disclose or log it?",
  "Alright—should I record it just to be safe?",
  "Okay—do you want me to note it in the register?",
  "Got it—would you like me to tell my manager anyway?",
  "Understood—do you want me to file a quick disclosure?",
  "Okay—shall I donate it and record that?",
  "Thanks—want me to add a short entry to the register?",
  "Alright—do you want any follow-up from me now?"
];

/* Positive closers when the Detective states policy clearly */
const CLOSERS = [
  "Thanks, Detective — that’s clear. I’ll file the disclosure, donate the hamper, and keep my manager in the loop.",
  "Appreciate the guidance. I’ll disclose it today and arrange a donation so there’s no perception of influence.",
  "Cheers — understood. I’ll submit the form, log it properly and make sure my manager is notified.",
  "Thanks for setting that out plainly. I’ll record it, donate the hamper and follow the ABC rules going forward.",
  "Got it — I’ll disclose, donate, and keep to policy next time. Thanks for the steer.",
  "Thank you — I’ll handle this by the book and keep the policy top of mind with clients."
];

/* ----------------- Policy recognition (for successful close) ---------------- */
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

/* ----------------- Intent detection for your flow ---------------- */

/* A) “About the hamper” (what it is/value) */
function isHamperDescriptionAsk(msg){
  const m = norm(msg);
  return /(tell me|what|describe|explain).*(hamper)/i.test(m) ||
         /^hamper\??$/.test(m) ||
         /(what.*gift|what.*was it|about the hamper)/i.test(m);
}

/* B) Probe “how it came to be gifted” (who/why/linkage) */
function isWhoWhyProbe(msg){
  const m = norm(msg);
  return /(who (sent|gave|provided)|who.*(sender|from)|who arranged)/i.test(m) ||
         /(why.*(send|gift)|what.*reason|what.*for|what.*was the card|what.*note|card.*say|note.*say)/i.test(m) ||
         /(how.*came about|how.*come to be|how.*ended up)/i.test(m);
}

/* C) Quick timing probe (optional tiny fact) */
function isTimingProbe(msg){
  return /(when|what day|what date|how long).*(arrive|delivered|received|turn.*up)/i.test(norm(msg));
}

/* ----------------- Router ---------------- */
function routeReply({ message, history }){
  const tone = detectTone(message);

  // 0) If Detective already states policy correctly → pleasant close
  if (detectiveGaveCorrectPolicy(message)) {
    return { reply: rnd(CLOSERS) };
  }

  // 1) Greetings & small talk
  const g = detectGreetingIntent(message);
  if (g){
    if (g.kind === "hi")        return { reply: rnd(GREET.hi) };
    if (g.kind === "howareyou") return { reply: rnd(GREET.howareyou) };
    if (g.kind === "thanks")    return { reply: rnd(GREET.thanks) };
  }

  // 2) Accusatory/aggressive guardrails (short & calm)
  if (tone === "aggressive")  return { reply: "Let’s keep this professional and I’ll answer." };
  if (tone === "accusatory" && !isWhoWhyProbe(message)) return { reply: "I’ll cooperate—let’s keep it factual and measured." };

  // 3) Hamper description (what it is; short detail)
  if (isHamperDescriptionAsk(message)) {
    const line = rnd(FACTS.describeHamper);
    return { reply: line };
  }

  // 4) Who/why probe → give who/why + (optionally timing) → then ask “did I do wrong?”
  if (isWhoWhyProbe(message)) {
    const whoWhy = rnd(FACTS.whoWhy);
    const maybeTiming = Math.random() < 0.5 ? " " + rnd(FACTS.timing) : "";
    const ask = " " + rnd(ASK_IF_WRONG);
    return { reply: (whoWhy + maybeTiming + ask).trim() };
  }

  // 5) Timing probe (if asked directly)
  if (isTimingProbe(message)) {
    return { reply: `${rnd(FACTS.timing)} ${rnd(ASK_IF_WRONG)}` };
  }

  // 6) Yes/No style OR sentiment replies to the “did I do wrong?” stage
  if (isYesNoStart(message) || isAffirmative(message) || isNegative(message)) {
    if (isAffirmative(message)) {
      // Detective suggests it WAS wrong → ask what should she have done
      return { reply: rnd(ASK_WHAT_SHOULD_I_HAVE_DONE) };
    }
    if (isNegative(message)) {
      // Detective suggests NOT wrong → light nudge about next step
      return { reply: rnd(ASK_WHAT_NOW_IF_OK) };
    }
    // Ambiguous yes/no starter → keep it tight
    return { reply: "Could you clarify—was that a breach or okay under ABC?" };
  }

  // 7) Fallback: keep the flow moving towards who/why and decision
  return { reply: "Do you want the sender and reason, or what the card said?" };
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
    const history = String(body.history||""); // preserved for future use if you want stage-tracking

    const { reply } = routeReply({ message, history });
    return res.status(200).json({ ok:true, reply: clamp(reply) });
  }catch(e){
    return res.status(200).json({ ok:false, reply:"", error:"Server error." });
  }
}

module.exports = handler;
module.exports.default = handler;
