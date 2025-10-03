// /api/betty_tonebank.js
// Betty — guided flow with clean close, proposal-confirm endgame, and restart support.
// Returns { ok:true, reply, done?:true, marker? }.
// If done===true, end the chat in Storyline. Type "restart" to begin a new chat.

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
  return /^(yes|yep|yeah|correct|right|ok(ay)?|fine|please (do|go ahead)|do it|go ahead)\b/.test(m) ||
         /(breach|wrong|against|not allowed|shouldn'?t|cannot|can'?t|over the threshold|linked to (decision|tender|renewal))/i.test(m);
}
function isNegative(msg){
  const m = norm(msg);
  return /^(no|nope|nah|not really|don'?t|do not)\b/.test(m) ||
         /(within (policy|limits)|seems fine|acceptable)/i.test(m);
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

/* ----------------- Scenario facts ---------------- */
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

/* ----------------- Flow banks ---------------- */
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

const NUDGE_SINGLE = [
  "Shall I start with who sent it?",
  "Would you like the value first?",
  "Shall I give you the timing?",
  "Do you want what the card said?"
];

/* --- Proposal (action the Detective can confirm to close) --- */
const PROPOSE_ACTION = [
  "I can file the disclosure, donate the hamper, and notify my manager—shall I do that now?",
  "I’ll submit the disclosure, arrange a donation, and loop in my manager—do you want me to proceed?",
  "I can record it today, donate or return the hamper, and inform my manager—should I go ahead?",
  "I’ll file the form, donate the hamper, and keep my manager updated—okay to proceed?"
];

/* Successful closers (policy is stated or proposal is confirmed) */
const CLOSERS = [
  "Thanks, Detective — that’s clear. I’ll file the disclosure, donate the hamper, and keep my manager in the loop.",
  "Appreciate the guidance. I’ll disclose it today and arrange a donation so there’s no perception of influence.",
  "Cheers — understood. I’ll submit the form, log it properly and make sure my manager is notified.",
  "Got it — I’ll file the disclosure, return the hamper, and update my manager.",
  "Understood. I’ll disclose, donate, and stick to the rules going forward."
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

/* ----------------- Intent detectors ---------------- */
function isOpenDescribeAsk(msg){
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

/* ----------------- Stage detection from history ---------------- */
function countOccur(re, text){
  const s = String(text||""); let c=0, m; const g=new RegExp(re.source, re.flags.includes('g')?re.flags:re.flags+'g');
  while((m=g.exec(s))!==null){ c++; if(g.lastIndex===m.index) g.lastIndex++; }
  return c;
}
function stageFromHistory(historyText){
  const h = norm(historyText||"");
  const saidDescribe = /(luxury.*hamper|premium hamper|high-end hamper)/i.test(historyText||"");
  const saidWhoWhy   = /(clientco.*raj|raj.*clientco|locking in the renewal)/i.test(historyText||"");
  const askedWrongRe = /(did i do something wrong|breached the rules|problem under abc|wrong call|against our policy|cross a line|should i not have accepted)/i;
  const askedWhatRe  = /(what should i have done|correct step|how should i have handled|proper process|right way to deal)/i;
  const proposalRe   = /(file (the )?disclosure.*(donate|return).*(notify|manager)|submit the disclosure.*(donation|donate).*(manager)|record it.*(donate|return).*(inform my manager)|file the form.*(donate|return).*(manager)|okay to proceed\?|shall i do that now\?|should i go ahead\?)/i;

  const askedWrong   = askedWrongRe.test(h);
  const askedWhatDo  = askedWhatRe.test(h);
  const askedWrongCount = countOccur(askedWrongRe, h);
  const askedWhatDoCount = countOccur(askedWhatRe, h);
  const proposedOnce = proposalRe.test(h);

  const nudgedOnce   = /(shall i start with who sent it\?|would you like the value first\?|shall i give you the timing\?|do you want what the card said\?)/i.test(h);
  const closed       = /<<CONVO_CLOSED>>/i.test(h);
  return { saidDescribe, saidWhoWhy, askedWrong, askedWhatDo, askedWrongCount, askedWhatDoCount, proposedOnce, nudgedOnce, closed };
}

/* ----------------- Router ---------------- */
function routeReply({ message, history }){
  const stage = stageFromHistory(history||"");

  // Allow restart after a closed chat
  if (stage.closed) {
    if (/restart|new chat|start over/i.test(message)) {
      return { reply: "Starting a fresh chat. How can I help?", done: false };
    }
    if (detectGreetingIntent(message)) {
      return { reply: "We’ve wrapped this case. Type “restart” to start a new chat.", done: true };
    }
    return { reply: "", done: true };
  }

  // Immediate close if Detective states policy correctly this turn
  if (detectiveGaveCorrectPolicy(message)) {
    return { reply: rnd(CLOSERS), done: true, closeMarker: true };
  }

  // Greetings
  const g = detectGreetingIntent(message);
  if (g){
    if (g.kind === "hi")        return { reply: rnd(GREET.hi) };
    if (g.kind === "howareyou") return { reply: rnd(GREET.howareyou) };
    if (g.kind === "thanks")    return { reply: rnd(GREET.thanks) };
  }

  // Open “tell/explain about the hamper” -> WHAT + VALUE + ask if wrong
  if (isOpenDescribeAsk(message)) {
    const line = rnd(FACTS.describeHamper);
    return { reply: `${line} ${rnd(ASK_IF_WRONG)}` };
  }

  // Short “hamper?” -> brief WHAT then ask if wrong (if not already asked)
  if (isShortHamperAsk(message) && !stage.saidDescribe) {
    const line = rnd(FACTS.describeHamper);
    return { reply: `${line} ${rnd(ASK_IF_WRONG)}` };
  }

  // WHO / WHY / CARD / TIMING -> answer then ask if wrong (once)
  if (isWhoAsk(message) || isWhyOrCardAsk(message) || isTimingAsk(message) || (stage.saidDescribe && !stage.saidWhoWhy)) {
    const bits = [ rnd(FACTS.whoWhy) ];
    if (Math.random() < 0.5) bits.push(rnd(FACTS.timing));
    const ask = stage.askedWrong ? "" : " " + rnd(ASK_IF_WRONG);
    return { reply: `${bits.join(" ")}${ask}`.trim() };
  }

  // After “Did I do something wrong?”:
  // A) Detective confirms breach (affirmative/critical) but hasn't stated policy → propose concrete action
  if (stage.askedWrong && (isYesNoStart(message) || isAffirmative(message) || isNegative(message))) {

    // If policy is stated, close immediately
    if (detectiveGaveCorrectPolicy(message)) {
      return { reply: rnd(CLOSERS), done: true, closeMarker: true };
    }

    // Affirmative breach acknowledgement path
    if (isAffirmative(message)) {
      // If we've already proposed action and the detective says yes/ok → close
      if (stage.proposedOnce) {
        return { reply: rnd(CLOSERS), done: true, closeMarker: true };
      }
      // Otherwise propose the specific action for a simple yes/no
      return { reply: rnd(PROPOSE_ACTION) };
    }

    // Negative/unsure path → nudge to minimal next step
    if (isNegative(message)) {
      return { reply: rnd(ASK_WHAT_NOW_IF_OK) };
    }

    // Ambiguous yes/no starter → ask for clarity
    return { reply: rnd(ASK_FOR_CLARITY) };
  }

  // If we already asked “what should I have done?”, we want a policy statement.
  // To avoid loops, give a crisp hint once, then close on confirmation.
  if (stage.askedWhatDo) {
    if (stage.proposedOnce) {
      // A proposal was made previously; if the detective is now affirmative, close.
      if (isAffirmative(message)) {
        return { reply: rnd(CLOSERS), done: true, closeMarker: true };
      }
    }
    // Provide a precise hint and ask for confirmation → next affirmative will close
    return { reply: "ABC expects: disclose over £25, avoid gifts near decisions, and return or donate while notifying your manager. Is that correct?" };
  }

  // Forward-driving nudges if off-track:
  if (!stage.saidDescribe) return { reply: `${rnd(FACTS.describeHamper)} ${rnd(ASK_IF_WRONG)}` };
  if (!stage.saidWhoWhy)   return { reply: `${rnd(FACTS.whoWhy)} ${rnd(ASK_IF_WRONG)}` };
  if (!stage.askedWrong)   return { reply: rnd(ASK_IF_WRONG) };

  // Final fallback: single, purposeful nudge
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

    const { reply, done, closeMarker } = routeReply({ message, history });

    // When closing, we send done:true. Storyline can add a history marker so subsequent calls stop.
    const payload = closeMarker
      ? { ok:true, reply: clamp(reply), done: true, marker: "<<CONVO_CLOSED>>" }
      : { ok:true, reply: clamp(reply), done: !!done };

    return res.status(200).json(payload);
  }catch(e){
    return res.status(200).json({ ok:false, reply:"", error:"Server error." });
  }
}

module.exports = handler;
module.exports.default = handler;
