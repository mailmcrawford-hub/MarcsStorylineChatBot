// /api/betty_tonebank.js
// Betty — tone-bank bot for Storyline. Returns { ok:true, reply }.
// No prefixy intros. Adds policy-linked follow-ups per context. Self-contained.

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
  if (/(!{2,}|you lied|obviously|ridiculous|unbelievable|\bnow\b.*\banswer\b)/i.test(msg) || /(shut up|listen|answer me)/i.test(m)) return "aggressive";
  if (/(you (should|must)|you knew|you realised|against policy|breach|violate|why did you)/i.test(m)) return "accusatory";
  if (/(section \d|per policy|as per|threshold|sub clause|pursuant|hereby|therefore)/i.test(m)) return "legalistic";
  if (/(asap|quick|hurry|fast|right now|urgent)/i.test(m)) return "rushed";
  if (/(could you|please|thanks|thank you|appreciate)/i.test(m)) return "polite";
  if (/(\?|help me understand|what happened|can you clarify)/i.test(m)) return "probing";
  return "neutral";
}

/* ---------- Greeting detection ---------- */
function detectGreetingIntent(message){
  const t = message.trim();
  const m = norm(t);
  if (/^(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening))(,|\!|\.)?\s*(betty|there)?\s*$/i.test(t)) return { kind:"hi" };
  if (/(how (are|r) (you|u)|how's it going|how are things|you ok\??|you doing ok\??)/i.test(m)) return { kind:"howareyou" };
  if (/^(thanks|thank you|cheers|much appreciated)[.!]?$/.test(t) || /(thanks|thank you|cheers|appreciate that)/i.test(m)) return { kind:"thanks" };
  return null;
}

/* ---------- Greeting banks ---------- */
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

/* ---------- Short yes/no bank (kept minimal, no prefixes) ---------- */
const YESNO = {
  polite:    ["Yes.","No.","I believe so.","I don’t think so.","Likely yes.","Probably not."],
  probing:   ["Yes.","No.","Yes, within reason.","No, not here.","Seems so.","Doesn’t look like it."],
  supportive:["Yes—thanks for checking.","No—good call to ask.","Yes, that fits.","No, not this time.","Yes, that aligns.","No, I wouldn’t say so."],
  neutral:   ["Yes.","No.","Think so.","Don’t think so.","Probably.","Probably not."],
  legalistic:["Affirmative.","Negative.","Correct.","Incorrect.","Applicable.","Not applicable."],
  accusatory:["Yes—happy to clarify.","No—that’s not right.","Yes, but I can explain.","No, and I can explain.","Yes, if needed.","No, not in my case."],
  aggressive:["Yes.","No.","If we keep this professional—yes.","No—please keep it measured.","Yes, but calmly.","No."]
};

/* ---------- Follow-up banks (link answer → next policy step) ---------- */
const FOLLOWUP = {
  general: {
    polite:    ["Do you want me to start the disclosure?","Shall I note this in the form now?","Do you want me to tell my manager too?","Should I log it in the register?","Do you want me to return or donate it?","Shall I record this today?"],
    probing:   ["Do you want the disclosure raised now?","Should I log this while we’re here?","Do you want names and dates added to the form?","Shall I confirm the amount in the register?","Do you want manager notification added?","Should I proceed with the form?"],
    supportive:["Shall I file the disclosure and update my manager?","Do you want me to donate it and log it?","Shall I record the amount and timing?","Do you want me to attach the card text?","Should I add this to the register now?","Want me to move ahead with the form?"],
    neutral:   ["Should I file the disclosure?","Log it now?","Notify my manager as well?","Return or donate it?","Add it to the register?","Proceed with the form?"],
    legalistic:["Shall I submit the disclosure form?","Add an entry to the register?","Notify my line manager?","Return or donate as appropriate?","Attach card wording to the file?","Confirm amount and timing in the form?"],
    accusatory:["Do you want me to file the form now?","Should I log it and notify my manager?","Return or donate it to resolve this?","Add the card text to the record?","Record the amount formally?","Proceed with disclosure today?"],
    aggressive:["If we keep this professional—should I file the form?","Log it now?","Notify my manager and move on?","Return or donate it—your call?","Record the amount in the register?","Proceed with disclosure?"]
  },
  afterWho: {
    polite:    ["Do you want me to add Raj and ClientCo to the disclosure?"],
    probing:   ["Should I include Raj and ClientCo on the form?"],
    supportive:["Shall I list Raj and ClientCo in the record?"],
    neutral:   ["Add Raj and ClientCo to the form?"],
    legalistic:["Include Raj and ClientCo as counterparties?"],
    accusatory:["Do you want Raj and ClientCo named on the form?"],
    aggressive:["Add Raj and ClientCo to the record—yes?"]
  },
  afterValue: {
    polite:    ["Given the amount, should I file the disclosure and donate it?"],
    probing:   ["With that value, do you want disclosure and donation?"],
    supportive:["Do you want me to disclose and donate based on the value?"],
    neutral:   ["With that value—disclose and donate?"],
    legalistic:["Value noted—proceed with disclosure and donation?"],
    accusatory:["Value recorded—should I file and donate it now?"],
    aggressive:["With that amount—file the form and donate it?"]
  },
  afterTiming: {
    polite:    ["As it’s close to the renewal, should I disclose and donate?"],
    probing:   ["Given the timing, do you want disclosure and donation?"],
    supportive:["Because of the timing, should I log and donate it?"],
    neutral:   ["Timing noted—disclose and donate?"],
    legalistic:["Timing linked to decision—proceed with disclosure/donation?"],
    accusatory:["That timing is sensitive—should I file and donate now?"],
    aggressive:["Given the timing—do I file and donate?"]
  },
  afterCard: {
    polite:    ["With that wording, should I attach the card and file disclosure?"],
    probing:   ["Include the card text on the form and donate it?"],
    supportive:["Shall I add the card wording to the record and donate it?"],
    neutral:   ["Attach card text and file the form?"],
    legalistic:["Record card text as evidence and submit disclosure?"],
    accusatory:["Card suggests intent—do I file and donate now?"],
    aggressive:["Card noted—file and donate?"]
  },
  afterDelivery: {
    polite:    ["Do you want the courier detail added to the form?"],
    probing:   ["Add the courier/reception details to the record?"],
    supportive:["Shall I note the courier to reception on the form?"],
    neutral:   ["Add delivery details to the record?"],
    legalistic:["Record courier-to-reception in the file?"],
    accusatory:["Add delivery details to the form now?"],
    aggressive:["Log courier delivery—yes?"]
  }
};

/* ---------- Closers (successful outcome) ---------- */
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

/* ---------- Follow-up selector ---------- */
function followUp(tone, context){
  const t = FOLLOWUP[context] && FOLLOWUP[context][tone] ? FOLLOWUP[context][tone] : null;
  if (t && t.length) return rnd(t);
  const g = FOLLOWUP.general[tone] || FOLLOWUP.general.neutral;
  return rnd(g);
}

/* ---------- Router ---------- */
function routeReply({ message, history }){
  const tone = detectTone(message);
  const m = norm(message);

  const alreadyWho   = hasConfirmed(history, "who");
  const alreadyValue = hasConfirmed(history, "value");

  // 0) Close if Detective states policy correctly
  if (detectiveGaveCorrectPolicy(message)) {
    return { reply: rnd(CLOSERS) };
  }

  // 1) Greetings
  const g = detectGreetingIntent(message);
  if (g){
    const toneBlock = GREET[g.kind][tone] || GREET[g.kind].neutral;
    return { reply: rnd(toneBlock) };
  }

  // 2) Tone hard-limits
  if (tone === "aggressive") return { reply: "Let’s keep this professional and I’ll answer." };
  if (tone === "accusatory" && !(asksWho(m) || asksValue(m))) return { reply: "I’ll cooperate—let’s keep it factual and measured." };

  // 3) Yes/No style
  if (isYesNo(message)) {
    const block = YESNO[tone] || YESNO.neutral;
    return { reply: rnd(block) };
  }

  // 4) Explain/Tell me (one nugget + policy-linked follow-up)
  if (isExplain(message)) {
    if (!alreadyWho)   return { reply: `${FACT_LINES.who} ${followUp(tone,"afterWho")}` };
    if (!alreadyValue) return { reply: `${FACT_LINES.value} ${followUp(tone,"afterValue")}` };
    const nexts = [
      ["delivery", FACT_LINES.delivery],
      ["timing",   FACT_LINES.timing],
      ["card",     FACT_LINES.card]
    ];
    const [ctx, line] = rnd(nexts);
    return { reply: `${line} ${followUp(tone, ctx==="delivery"?"afterDelivery":ctx==="timing"?"afterTiming":"afterCard")}` };
  }

  // 5) Direct facts (who/value) with contextual follow-up
  if (asksWho(message))   return { reply: `${FACT_LINES.who} ${followUp(tone,"afterWho")}` };
  if (asksValue(message)) return { reply: `${FACT_LINES.value} ${followUp(tone,"afterValue")}` };

  // 6) After BOTH facts are confirmed → ask for policy decision
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

  // 7) Fallback: reveal one missing fact with a sensible follow-up
  if (!alreadyWho)   return { reply: `${FACT_LINES.who} ${followUp(tone,"afterWho")}` };
  if (!alreadyValue) return { reply: `${FACT_LINES.value} ${followUp(tone,"afterValue")}` };

  // 8) Final fallback: neutral nudge to policy
  return { reply: followUp(tone,"general") };
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
