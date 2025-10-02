// /api/betty — Persona-rich Betty for FMCG; varied, friendly, a wee bit Scottish, policy closes on learner cue (CommonJS)

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

/* -------------------------- PERSONA CONFIG (customised) -------------------------- */
const PERSONA = {
  name: "Betty Shaw",
  role: "Sales Executive at Acme Group (FMCG)",
  city: "Glasgow",
  clients: "public sector, SMEs and enterprise buyers",
  vibe: ["kind", "polite", "open", "helpful", "calm & steady"],
  // Light Scottish flavour + life colour; used occasionally
  details: [
    "I’m partial to a flat white before client calls",
    "my desk has colour-coded sticky notes",
    "I keep a tiny paper diary to track demos",
    "I try a wee bake on Sundays if the oven behaves",
    "weekend walks by the Clyde clear my head",
    "I tidy receipts the minute I’m back from meetings",
    "I’ll sneak in the odd dad joke if you let me"
  ],
  openers: [
    "Hi Detective, how can I help?",
    "Hello Detective, what can I do for you today?",
    "Hiya — happy to chat, what’s on your mind?"
  ],
  // Sign-offs when the learner states correct policy
  closeThanks: [
    "Thanks Detective — clear.",
    "Cheers, I’ll do that.",
    "Brilliant — I’m on it."
  ]
};

const LIMITS = { gift: 50, giftPublicOfficial: 25, hospitality: 200 };
const MAX_SENTENCES = 4;
const MAX_CHARS = 380;

/* -------------------------- UTILITIES -------------------------- */
function clamp(t, n){ t = (t||"").toString(); return t.length <= n ? t : t.slice(0, n); }
function toSentences(s){ return (s||"").replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]?/g) || []; }
function capSentences(s, max){ return toSentences(s).slice(0, max).join(" ").trim(); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function tone(s){
  let out = s || pick(PERSONA.openers);
  // calm & steady cadence, plus occasional wee local detail
  if (Math.random() < 0.14 && out.length < 280) out += ` ${pick(PERSONA.details)}.`;
  return clamp(capSentences(out, MAX_SENTENCES), MAX_CHARS);
}
function lastBetty(history) {
  if (!history) return "";
  const lines = history.split(/\r?\n/).reverse();
  for (const ln of lines) {
    const m = ln.match(/^Betty:\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return "";
}
function chooseDifferent(list, last) {
  const first = pick(list);
  if (!last || list.length === 1) return first;
  let tries = 0, candidate = first;
  while (candidate.toLowerCase() === last.toLowerCase() && tries < 4) {
    candidate = pick(list); tries++;
  }
  return candidate;
}

/* -------------------------- CONVERSATION LOGIC -------------------------- */

// Close when the learner states a correct policy/rule
function detectLearnerPolicy(msg){
  const m = (msg || "").toLowerCase();

  if (/(decline|refuse|not accept).*(tender|rfp|bid)|(tender|rfp|bid).*(decline|refuse|not accept)/.test(m))
    return `I’ll decline anything during a tender and suggest a simple coffee after the award, then make a quick note.`;

  if (/(facilitation|unofficial).*(refuse|decline|do not pay)|refuse.*(facilitation|unofficial)/.test(m))
    return `I’ll refuse any ‘speed’ payments; if there’s a genuine safety risk I’ll step away, pay the minimum only if unavoidable, and report right away.`;

  if (/(pause|hold|stop).*(agent|intermediary|third)| (escalate|compliance|due diligence).*(agent|intermediary|third)/.test(m))
    return `I’ll pause and escalate to Compliance for due diligence and transparent paperwork, otherwise we’ll step away.`;

  if (/(public official|mayor|council).*(decline|refuse)/.test(m))
    return `I’ll decline the request from the public official and escalate; if we help, I’ll suggest a transparent CSR route.`;

  if (/(conflict).*(hr|process)|standard hr|no preferential|no preference/.test(m))
    return `I’ll raise the conflict and route it via the standard HR process with no preferential treatment, and record the decision.`;

  if (/gift|hamper|present|bottle|card|voucher/i.test(m) && /(accept|okay|fine)/.test(m) && /(£?\s?50|fifty|register|log|g(&|and)h)/.test(m))
    return `I’ll keep any gift modest, within limits, and add it to the G&H Register with a polite note.`;

  if (/(public official|official|soe|state).*?(token|small|promo).*?(approval|pre-approval|compliance)/.test(m))
    return `For public officials I’ll keep to token items only, get Compliance pre-approval, and keep a simple distribution list.`;

  if (/(economy)/.test(m) && /(agenda|bona fide|company.to.company|company-?to-?company|records|receipts)/.test(m))
    return `I’ll book economy with a clear agenda, keep payments company-to-company, and save tidy records.`;

  return null;
}

/* -------------------------- SCENARIOS (varied) -------------------------- */
const SCENARIOS = [
  { key: "tickets_tender",
    match: /ticket|match|football|game/i, also: /tender|rfp|bid/i,
    variants: [
      "A supplier offered football tickets while we’re mid-bid. The timing feels sensitive; I can suggest a simple catch-up after the award.",
      "I’ve been offered about £180 in match tickets during a live tender. Happy to park hospitality till later if you prefer.",
      "Tickets popped up while we’re bidding — generous but awkward timing. We could do a wee coffee after the decision instead."
    ]},
  { key: "customs_speed_cash",
    match: /customs|border|shipment/i, also: /cash|speed|fast|quick/i,
    variants: [
      "Someone at the border hinted £20 would ‘speed things up’. I can ask for the official route or step away if it feels off.",
      "At customs I was nudged for a small ‘fee’ to hurry a shipment. I can push for the proper process instead.",
      "A guard suggested a quick cash payment to move things along. I can decline and look for the formal path."
    ]},
  { key: "agent_offshore",
    match: /agent|intermediary|consultant/i, also: /offshore|commission|percent|%/i,
    variants: [
      "An agent wants 15% paid to an offshore account. I can pause it and gather their paperwork for review.",
      "I’ve been asked for a 15% commission via an offshore entity. I can hold while we check them properly.",
      "The intermediary asked for offshore payment details. I’ll collect documents if you want to take a view."
    ]},
  { key: "mayor_fund",
    match: /mayor|permit|council|official/i, also: /fund|donation|£|2,?000|2000/i,
    variants: [
      "The mayor’s office mentioned a £2,000 ‘community fund’ linked to our permit. It made me pause; I can reply carefully.",
      "I’ve had a ‘community contribution’ request tied to a permit renewal. I can push back politely if you prefer.",
      "A public office asked for a £2,000 fund before renewal. I’m unsure — your steer?"
    ]},
  { key: "client_cousin_hire",
    match: /hire|cousin|relative|nephew|niece|family/i, also: /client|customer/i,
    variants: [
      "A client asked us to hire their cousin. I’m happy to pass on the CV and keep the process neat and fair.",
      "There’s a nudge to bring in a client’s relative. I can route it properly and keep notes tidy.",
      "A customer floated their cousin for a role. I can forward details and keep the process clean."
    ]},
  { key: "hamper_30",
    match: /hamper|gift|present|bottle|rioja|voucher|card/i,
    variants: [
      `A vendor sent a small hamper, roughly £30. I can send thanks and note it, or return it if you’d prefer.`,
      "I received a modest gift from a supplier — nothing fancy. I can log it or send it back if you want.",
      "A wee bottle and some snacks arrived after a demo. I can drop a thank-you and keep it tidy."
    ]},
  { key: "soe_tote",
    match: /tote|bag|swag|promo|souvenir/i, also: /soe|state|official|delegates|public/i,
    variants: [
      "We have simple totes for visitors from a state-owned firm. Happy to hand them out and keep a quick list if needed.",
      "There are promo totes for the SOE delegates. I can keep it light and note who gets one.",
      "I’ve basic promo bits for public-sector guests. I can keep distribution tidy."
    ]},
  { key: "business_class",
    match: /flight|travel|hotel|business class|business-class/i,
    variants: [
      "The team suggested business-class for a prospect visit. I can keep it simple and practical — your call.",
      "Travel came up — someone floated business-class. I’m fine with something straightforward.",
      "Flights are being discussed for a demo. I’ll keep it sensible unless you say otherwise."
    ]}
];

function detectScenario(msg){
  for (const sc of SCENARIOS){
    if (sc.match.test(msg) && (!sc.also || sc.also.test(msg))) return sc;
  }
  return null;
}

/* -------------------------- INTENT BANKS (varied) -------------------------- */
const ANSWERS = {
  engage: [
    "Of course — go ahead. What’s on your mind?",
    "Sure thing, Detective. Fire away.",
    "Absolutely — I’m all ears."
  ],
  smalltalk: [
    "I’m good, thank you. What would you like me to look into?",
    "All well here, thanks. What shall we talk through?",
    "Doing fine today — how can I help?"
  ],
  // small talk extras themed to your preferences
  smalltalkExtras: [
    "Had a wee wander at the weekend — fresh air helps the sales brain.",
    "Trying a new scone recipe later, wish me luck.",
    "Caught the football highlights — still not over that miss.",
    "The dog tried to eat my sticky notes again."
  ],
  gifts: [
    `If you’re comfortable, I’ll keep it modest (around £${LIMITS.gift}) and make a short note.`,
    "I can send thanks and keep it simple, or return it if you’d rather.",
    "Happy to accept only if it’s small and sensible — otherwise I’ll decline politely."
  ],
  register: [
    "I’ll note who it was from, a brief description, rough value and the date.",
    "I can add a short entry with names, item, estimate and when it happened.",
    "I’ll keep the line neat so it’s easy to check later."
  ],
  hospitality: [
    "A simple coffee works well; I’ll keep it low-key.",
    "Yes, I can set up a short catch-up that feels comfortable.",
    "Happy to meet — I’ll keep it straightforward."
  ],
  officials: [
    "I’ll keep it very modest and clear, and check with you before giving anything.",
    "I can keep it token-level and make sure it’s transparent.",
    "I’ll keep it small and noted, and check in with you first."
  ],
  travel: [
    "I can keep travel simple — economy is fine.",
    "I’ll book something practical and tidy on receipts.",
    "Happy with economy and a clear agenda."
  ],
  thirdparty: [
    "I can pause and gather their details and paperwork.",
    "I’ll ask for a straightforward contract and invoices for you to review.",
    "I can collect contacts, company info and sample invoices."
  ],
  donations: [
    "I can enquire about a transparent route if you want to support something locally.",
    "Happy to ask a few questions and keep it above board.",
    "I can check options and keep it tidy."
  ],
  genericQ: [
    "Happy to help — tell me a bit more.",
    "I can help with that. What’s the situation?",
    "Alright — give me the outline and I’ll follow."
  ],
  clients: [
    "I like a clear agenda so we get to the point.",
    "Happy to keep meetings focused and friendly.",
    "Let’s keep it practical and outcome-based."
  ],
  records: [
    "I’ll keep notes neat so they’re easy to check later.",
    "I can add concise entries to the register.",
    "I’ll keep the books tidy and simple to follow."
  ],
  agentInfo: [
    "I’ll collect straightforward paperwork from the agent.",
    "I can ask for simple details and contacts to review.",
    "I’ll get the basics together so you can take a view."
  ],
  conflict: [
    "I’ll mention any personal link openly so everyone’s comfortable.",
    "I’ll flag the connection so decisions stay clean.",
    "I’ll call out the link early so it doesn’t colour things."
  ],
  genericS: [
    "Understood.",
    "Thanks for that.",
    "Got it."
  ],
  // wee dad-joke (rare; fun toggle)
  dadJokes: [
    "I told my team I was two-tired after a long drive — they said that’s a wheelie bad joke.",
    "I tried baking bread for a client demo — it didn’t rise to the occasion."
  ]
};

function maybeAddColour(line){
  // 20% chance of adding a wee extra detail, 5% chance of a dad joke
  if (Math.random() < 0.05) return `${line} ${pick(ANSWERS.dadJokes)}`
  if (Math.random() < 0.20) return `${line} ${pick(ANSWERS.smalltalkExtras)}`
  return line;
}

/* -------------------------- RESPONDERS -------------------------- */
function answerQuestion(msg, last) {
  const m = (msg || "").toLowerCase();

  if (/(can we talk|can i ask|can we chat|are you free|got a minute|quick question|can i run something by you)/i.test(m))
    return chooseDifferent(ANSWERS.engage, last);

  if (/how are you|how’s it going|you ok|are you well/.test(m))
    return chooseDifferent(ANSWERS.smalltalk, last);

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

/* -------------------------- HTTP HANDLER -------------------------- */
module.exports = function handler(req, res){
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET"){
    return res.status(200).json({ ok: true, reply: pick(PERSONA.openers) });
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
      return res.status(200).json({ ok: true, reply: tone(pick(PERSONA.openers)) });
    }

    // 0) If learner states a correct rule/policy → warm close
    const close = detectLearnerPolicy(message);
    if (close){
      const thanks = pick(PERSONA.closeThanks);
      return res.status(200).json({ ok: true, reply: tone(`${thanks} ${close}`) });
    }

    // 1) Scenario-specific variety
    const sc = detectScenario(message);
    if (sc){
      const prev = lastBetty(history);
      const base = chooseDifferent(sc.variants, prev);
      return res.status(200).json({ ok: true, reply: tone(maybeAddColour(base)) });
    }

    // 2) Direct Q&A vs statement, both with topic-aware variant banks
    const prevBetty = lastBetty(history);
    const base = /\?\s*$/.test(message)
      ? answerQuestion(message, prevBetty)
      : replyToStatement(message, prevBetty);

    return res.status(200).json({ ok: true, reply: tone(maybeAddColour(base)) });

  } catch (e){
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
