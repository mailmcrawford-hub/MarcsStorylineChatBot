// /api/betty — Open chat v3.1: engage intent, topic-aware answers, no bland fillers (CommonJS)

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

const LIMITS = { gift: 50, giftPublicOfficial: 25, hospitality: 200 };

const BETTY = {
  name: "Betty",
  role: "Sales Executive at Acme Group",
  home: "Manchester",
  quirks: [
    "I’m partial to a flat white before client calls",
    "I keep a tiny paper diary with sticky notes"
  ],
  openerVariants: [
    "Hi Detective, how can I help?",
    "Hello Detective, what can I do for you today?",
    "Hi there, happy to help — what’s on your mind?"
  ]
};

const MAX_SENTENCES = 4;
const MAX_CHARS = 380;

function clamp(t, n){ t = (t||"").toString(); return t.length <= n ? t : t.slice(0, n); }
function toSentences(s){ return (s||"").replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]?/g) || []; }
function capSentences(s, max){ return toSentences(s).slice(0, max).join(" ").trim(); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function tone(s){
  let out = s || pick(BETTY.openerVariants);
  if (Math.random() < 0.1 && out.length < 280) out += ` ${pick(BETTY.quirks)}.`;
  return clamp(capSentences(out, MAX_SENTENCES), MAX_CHARS);
}

// ---- last Betty line (to avoid repeating exact same wording) ----
function lastBetty(history) {
  if (!history) return "";
  const lines = history.split(/\r?\n/).reverse();
  for (const ln of lines) {
    const m = ln.match(/^Betty:\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return "";
}

// ---- conversation ends when learner states a correct policy ----
function detectLearnerPolicy(msg){
  const m = (msg || "").toLowerCase();
  if (/(decline|refuse|not accept).*(tender|rfp|bid)|(tender|rfp|bid).*(decline|refuse|not accept)/.test(m))
    return "I’ll decline anything during a tender and suggest a simple coffee after the award, then make a quick note.";
  if (/(facilitation|unofficial).*(refuse|decline|do not pay)|refuse.*(facilitation|unofficial)/.test(m))
    return "I’ll refuse any ‘speed’ payments; if there’s a genuine safety risk I’ll step away, pay the minimum only if unavoidable, and report right away.";
  if (/(pause|hold|stop).*(agent|intermediary|third)| (escalate|compliance|due diligence).*(agent|intermediary|third)/.test(m))
    return "I’ll pause and escalate to Compliance for due diligence and transparent paperwork, otherwise we’ll step away.";
  if (/(public official|mayor|council).*(decline|refuse)/.test(m))
    return "I’ll decline the request from the public official and escalate; if we help, I’ll suggest a transparent CSR route.";
  if (/(conflict).*(hr|process)|standard hr|no preferential|no preference/.test(m))
    return "I’ll raise the conflict and route it via the standard HR process with no preferential treatment, and record the decision.";
  if (/gift|hamper|present|bottle|card|voucher/i.test(m) && /(accept|okay|fine)/.test(m) && /(£?\s?50|fifty|register|log|g(&|and)h)/.test(m))
    return "I’ll keep any gift modest, within limits, and add it to the G&H Register with a polite note.";
  if (/(public official|official|soe|state).*?(token|small|promo).*?(approval|pre-approval|compliance)/.test(m))
    return "For public officials I’ll keep to token items only, get Compliance pre-approval, and keep a simple distribution list.";
  if (/(economy)/.test(m) && /(agenda|bona fide|company.to.company|company-?to-?company|records|receipts)/.test(m))
    return "I’ll book economy with a clear agenda, keep payments company-to-company, and save tidy records.";
  return null;
}

// ---- scenarios (for richer context) ----
const SCENARIOS = [
  { key: "tickets_tender",
    match: /ticket|match|football|game/i, also: /tender|rfp|bid/i,
    speak: () => "A supplier offered football tickets while we’re mid-bid. The timing feels sensitive; I can suggest a simple catch-up after the award." },
  { key: "customs_speed_cash",
    match: /customs|border|shipment/i, also: /cash|speed|fast|quick/i,
    speak: () => "Someone at the border hinted £20 would speed things up. I can ask for the official route or step away if it feels off." },
  { key: "agent_offshore",
    match: /agent|intermediary|consultant/i, also: /offshore|commission|percent|%/i,
    speak: () => "An agent wants 15% paid to an offshore account. I can pause it and gather their paperwork for review." },
  { key: "mayor_fund",
    match: /mayor|permit|council|official/i, also: /fund|donation|£|2,?000|2000/i,
    speak: () => "The mayor’s office mentioned a £2,000 ‘community fund’ linked to our permit. It made me pause; I can reply carefully." },
  { key: "client_cousin_hire",
    match: /hire|cousin|relative|nephew|niece|family/i, also: /client|customer/i,
    speak: () => "A client asked us to hire their cousin. I’m happy to pass on the CV and keep the process neat and fair." },
  { key: "hamper_30",
    match: /hamper|gift|present|bottle|rioja|voucher|card/i,
    speak: () => "A vendor sent a small hamper, roughly £30. I can send thanks and note it, or return it if you’d prefer." },
  { key: "soe_tote",
    match: /tote|bag|swag|promo|souvenir/i, also: /soe|state|official|delegates|public/i,
    speak: () => "We have simple totes for visitors from a state-owned firm. Happy to hand them out and keep a quick list if needed." },
  { key: "business_class",
    match: /flight|travel|hotel|business class|business-class/i,
    speak: () => "The team suggested business-class for a prospect visit. I can keep it simple and practical — your call." }
];

function detectScenario(msg){
  for (const sc of SCENARIOS){
    if (sc.match.test(msg) && (!sc.also || sc.also.test(msg))) return sc;
  }
  return null;
}

// ---- topic-aware answers (two variants each to avoid repeats) ----
const ANSWERS = {
  engage: [
    "Of course — go ahead. What’s on your mind?",
    "Sure thing, Detective. Fire away."
  ],
  smalltalk: [
    "I’m good, thank you. What would you like me to look into?",
    "All well here, thanks. What shall we talk through?"
  ],
  gifts: [
    `If you’re comfortable, I’ll keep it modest (around £${LIMITS.gift}) and make a short note.`,
    "I can send thanks and keep it simple, or return it if you’d rather."
  ],
  register: [
    "I’ll note who it was from, a brief description, rough value and the date.",
    "I can add a short entry with names, item, estimate and when it happened."
  ],
  hospitality: [
    "A simple coffee works well; I’ll keep it low-key.",
    "Yes, I can set up a short catch-up that feels comfortable."
  ],
  officials: [
    "I’ll keep it very modest and clear, and check with you before giving anything.",
    "I can keep it token-level and make sure it’s transparent."
  ],
  travel: [
    "I can keep travel simple — economy is fine.",
    "I’ll book something practical and tidy on receipts."
  ],
  thirdparty: [
    "I can pause and gather their details and paperwork.",
    "I’ll ask for a straightforward contract and invoices for you to review."
  ],
  donations: [
    "I can enquire about a transparent route if you want to support something locally.",
    "Happy to ask a few questions and keep it above board."
  ],
  genericQ: [
    "Happy to help — tell me a bit more.",
    "I can help with that. What’s the situation?"
  ],
  clients: [
    "I like a clear agenda so we get to the point.",
    "Happy to keep meetings focused and friendly."
  ],
  records: [
    "I’ll keep notes neat so they’re easy to check later.",
    "I can add concise entries to the register."
  ],
  agentInfo: [
    "I’ll collect straightforward paperwork from the agent.",
    "I can ask for simple details and contacts to review."
  ],
  conflict: [
    "I’ll mention any personal link openly so everyone’s comfortable.",
    "I’ll flag the connection so decisions stay clean."
  ],
  genericS: [
    "Understood.",
    "Thanks for that."
  ]
};

function chooseDifferent(pair, last) {
  const [a,b] = pair;
  if (!last) return a;
  return (last.toLowerCase() === a.toLowerCase()) ? b : a;
}

// ---- question/statement responders ----
function answerQuestion(msg, last) {
  const m = (msg || "").toLowerCase();

  // Engage / permission to talk
  if (/(can we talk|can i ask|can we chat|are you free|got a minute|quick question|can i run something by you)/i.test(m))
    return chooseDifferent(ANSWERS.engage, last);

  // Small talk
  if (/how are you|how’s it going|you ok|are you well/.test(m))
    return chooseDifferent(ANSWERS.smalltalk, last);

  // Topic questions
  if (/should.*(accept|take).*(gift|hamper|present|bottle|voucher|card)/.test(m))
    return chooseDifferent(ANSWERS.gifts, last);
  if (/(what|how).*(g(&|and)h|register|log|record)/.test(m))
    return chooseDifferent(ANSWERS.register, last);
  if (/can.*(we|you).*(meet|coffee|lunch|dinner|tickets|event)/.test(m))
    return chooseDifferent(ANSWERS.hospitality, last);
  if (/(what|how).*(public.*official|mayor|council)/.test(m))
    return chooseDifferent(ANSWERS.officials, last);
  if (/how.*travel|can.*book.*(business|economy)/.test(m))
    return chooseDifferent(ANSWERS.travel, last);
  if (/agent|intermediary|third.*party.*(ok|normal|do|should)/.test(m))
    return chooseDifferent(ANSWERS.thirdparty, last);
  if (/donation|sponsorship|charity|csr.*(ok|how|can|should)/.test(m))
    return chooseDifferent(ANSWERS.donations, last);

  // Friendly catch-all
  return chooseDifferent(ANSWERS.genericQ, last);
}

function replyToStatement(msg, last) {
  const m = (msg||"").toLowerCase();
  if (/client|prospect|meeting|demo/.test(m))      return chooseDifferent(ANSWERS.clients, last);
  if (/register|record|log|books/.test(m))         return chooseDifferent(ANSWERS.records, last);
  if (/agent|intermediary|third party/.test(m))    return chooseDifferent(ANSWERS.agentInfo, last);
  if (/conflict|relative|cousin|friend/.test(m))   return chooseDifferent(ANSWERS.conflict, last);
  if (/travel|flight|hotel|expenses/.test(m))      return chooseDifferent(ANSWERS.travel, last);
  if (/donation|sponsorship|charity|csr/.test(m))  return chooseDifferent(ANSWERS.donations, last);
  return chooseDifferent(ANSWERS.genericS, last);
}

// ----------------- HTTP handler -----------------
module.exports = function handler(req, res){
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET"){
    return res.status(200).json({ ok: true, reply: pick(BETTY.openerVariants) });
  }
  if (req.method !== "POST"){
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    let body = req.body || {};
    if (typeof body === "string"){ try { body = JSON.parse(body); } catch { body = {}; } }

    const message  = (body.message || "").toString().trim();
    const history  = (body.history || "").toString();
    if (!message){
      return res.status(200).json({ ok: true, reply: tone(pick(BETTY.openerVariants)) });
    }

    // 0) If learner states a correct rule/policy → warm close
    const close = detectLearnerPolicy(message);
    if (close){
      return res.status(200).json({ ok: true, reply: tone("Thanks Detective — that’s clear. " + close) });
    }

    // 1) Scenario-specific context if matched
    const sc = detectScenario(message);
    if (sc){
      let resp = sc.speak(message);
      const prev = lastBetty(history);
      if (prev && resp.toLowerCase() === prev.toLowerCase()) {
        resp += " I’ll keep it straightforward.";
      }
      return res.status(200).json({ ok: true, reply: tone(resp) });
    }

    // 2) Direct Q&A vs statement with topic-aware, non-generic replies
    const prevBetty = lastBetty(history);
    const reply = /\?\s*$/.test(message)
      ? answerQuestion(message, prevBetty)
      : replyToStatement(message, prevBetty);

    return res.status(200).json({ ok: true, reply: tone(reply) });

  } catch (e){
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
