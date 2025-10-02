// /api/betty — Open-chat Betty. Natural, kind, policy-unaware until learner states it.
// CommonJS + CORS; safe for Vercel buildless functions.

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

// ---------- helpers: tone & variety ----------------------------------------
const MAX_SENTENCES = 4;
const MAX_CHARS = 380;

function clamp(t, n){ t = (t||"").toString(); return t.length <= n ? t : t.slice(0, n); }
function toSentences(s){ return (s||"").replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]?/g) || []; }
function capSentences(s, max){ return toSentences(s).slice(0, max).join(" ").trim(); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function tone(s){
  let out = s || pick(BETTY.openerVariants);
  // small, occasional human detail
  if (Math.random() < 0.15 && out.length < 280) out += ` ${pick(BETTY.quirks)}.`;
  return clamp(capSentences(out, MAX_SENTENCES), MAX_CHARS);
}

// ---------- policy recognition (conversation closes when true) --------------
function detectLearnerPolicy(msg){
  const m = (msg || "").toLowerCase();

  // 1) Gifts/hospitality during tenders → decline
  if (/(decline|refuse|not accept).*(tender|rfp|bid)| (tender|rfp|bid).*(decline|refuse|not accept)/.test(m))
    return "Thanks, I’ll decline anything while a tender is running and we can meet for a simple coffee after the award. I’ll note it properly.";

  // 2) Facilitation payments → refuse; safety exception then report
  if (/(facilitation|unofficial).*(refuse|decline|do not pay)|refuse.*(facilitation|unofficial)/.test(m))
    return "Got it. I’ll refuse any ‘speed’ payments; if there’s a genuine safety risk I’ll get out, pay the minimum only if unavoidable, and report straight away.";

  // 3) Third-party/agent offshore commission → pause & escalate due diligence
  if (/(pause|hold|stop).*(agent|intermediary|third).*|(escalate|compliance|due diligence).*(agent|intermediary|third)/.test(m))
    return "Understood. I’ll pause and escalate to Compliance for due diligence and transparent paperwork, otherwise we’ll step away.";

  // 4) Public official request/donation → decline & escalate / CSR route
  if (/(public official|mayor|council).*(decline|refuse)/.test(m))
    return "Thanks. I’ll decline the request from the public official and escalate; if we want to help, I’ll suggest a transparent CSR route.";

  // 5) Conflict of interest (client’s cousin) → standard HR, no preference
  if (/(conflict).*(hr|process)|standard hr|no preferential|no preference/.test(m))
    return "Will do. I’ll surface the conflict and route it through the standard HR process with no preferential treatment, and record the decision.";

  // 6) Modest gift ~£50 & register
  if (/(accept|okay|fine).*(£?\s?50|fifty)|log|register|g(&|and)h/.test(m) && /gift|hamper|present|bottle|card|voucher/i.test(m))
    return "Thanks Detective. I’ll only accept if it’s modest, keep it within limits, and log it in the G&H Register with a polite note.";

  // 7) Public officials token items ≤ £25 + pre-approval
  if (/(public official|official|soe|state).*?(token|small|promo).*?(approval|pre-approval|compliance)/.test(m))
    return "Understood. For public officials I’ll keep to token items only and get Compliance pre-approval, with a simple distribution list.";

  // 8) Travel economy, bona fide agenda, company-to-company, records
  if (/(economy)/.test(m) && /(agenda|bona fide|company.to.company|company-?to-?company|records|receipts)/.test(m))
    return "Great. I’ll book economy with a clear agenda, keep payments company-to-company, and save tidy records.";

  return null;
}

// ---------- scenarios: richer replies without pushing policy ----------------
const SCENARIOS = [
  {
    key: "tickets_tender",
    match: /ticket|match|football|game/i, also: /tender|rfp|bid/i,
    speak: () =>
      "A supplier offered football tickets while we’re mid-bid. It feels generous and a bit awkward timing. I could suggest a simple catch-up after the award if you prefer."
  },
  {
    key: "customs_speed_cash",
    match: /customs|border|shipment/i, also: /cash|speed|fast|quick/i,
    speak: () =>
      "Someone at the border hinted £20 would ‘speed things up’. I wasn’t sure that was right. I can ask for the official route or step away if it feels off."
  },
  {
    key: "agent_offshore",
    match: /agent|intermediary|consultant/i, also: /offshore|commission|percent|%/i,
    speak: () =>
      "An agent wants 15% paid to an offshore account. I can pause it and gather their paperwork if you want to take a look."
  },
  {
    key: "mayor_fund",
    match: /mayor|permit|council|official/i, also: /fund|donation|£|2,?000|2000/i,
    speak: () =>
      "The mayor’s office mentioned a £2,000 ‘community fund’ linked to our permit renewal. It made me pause. How would you like me to respond?"
  },
  {
    key: "client_cousin_hire",
    match: /hire|cousin|relative|nephew|niece|family/i, also: /client|customer/i,
    speak: () =>
      "A client asked us to hire their cousin. I’m happy to pass on the CV and keep the process neat if that helps."
  },
  {
    key: "hamper_30",
    match: /hamper|gift|present|bottle|rioja|voucher|card/i,
    speak: () =>
      `A vendor sent a small hamper, roughly £30. I can send thanks and note it, or return it if you’d rather.`
  },
  {
    key: "soe_tote",
    match: /tote|bag|swag|promo|souvenir/i, also: /soe|state|official|delegates|public/i,
    speak: () =>
      "We have simple totes for visitors from a state-owned firm. Happy to hand them out and keep a quick list if you need it."
  },
  {
    key: "business_class",
    match: /flight|travel|hotel|business class|business-class/i,
    speak: () =>
      "The team suggested business-class for a prospect visit. I can keep it simple and practical — your call."
  }
];

function detectScenario(msg){
  for (const sc of SCENARIOS){
    if (sc.match.test(msg) && (!sc.also || sc.also.test(msg))) return sc;
  }
  return null;
}

// ---------- free chat (no policy push; friendly & relevant) -----------------
function smallTalk(msg){
  return /(hello|hi|hey|morning|afternoon|evening|how are you|how’s it going|how are u)/i.test((msg||""));
}
function smallTalkReply(){
  const starts = [
    "Hi Detective, I’m good thank you.",
    "Hello Detective, I’m well, thanks.",
    "Hi, doing fine today."
  ];
  const ends = [
    "What can I do for you?",
    "How can I help?",
    "What would you like to look into?"
  ];
  return `${pick(starts)} ${pick(ends)}`;
}

function looseChat(msg){
  const m = (msg||"").toLowerCase();
  if (/travel|flight|hotel|expenses/.test(m))
    return "I travel now and then for demos and keep plans simple so they’re easy to explain later. Where should we start?";
  if (/client|prospect|meeting|demo/.test(m))
    return "With clients I like a clear agenda and honest chat so we get to the point. What’s the situation you’re exploring?";
  if (/register|record|log|books/.test(m))
    return "I’m happy to note things down if you want a record. Tell me what you’d like captured.";
  if (/agent|intermediary|third party|due diligence/.test(m))
    return "With agents I prefer plain contracts and tidy invoices. I can gather details if you want to review them.";
  if (/donation|sponsorship|charity|csr/.test(m))
    return "If there’s a community angle I can ask the right questions and keep it transparent. How would you like me to put it?";
  if (/conflict|relative|cousin|friend/.test(m))
    return "If there’s a personal link I’ll mention it openly so everyone is comfortable. What would you like me to do next?";
  // default mirror
  const snippet = (msg||"").replace(/\s+/g," ").trim().slice(0,140);
  return snippet ? `Thanks — I hear you on “${snippet}”. What would you like me to do?` : "I’m listening. What would you like me to do?";
}

// ---------- HTTP handler ----------------------------------------------------
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

    const message = (body.message || "").toString().trim();
    if (!message){
      return res.status(200).json({ ok: true, reply: tone(pick(BETTY.openerVariants)) });
    }

    // 1) If the learner states a correct policy/rule, close positively.
    const close = detectLearnerPolicy(message);
    if (close){
      return res.status(200).json({ ok: true, reply: tone(`Thanks Detective — that’s clear. ${close}`) });
    }

    // 2) Small talk: natural greeting variants (not a fixed preset)
    if (smallTalk(message)){
      return res.status(200).json({ ok: true, reply: tone(smallTalkReply()) });
    }

    // 3) Scenario phrasing from Betty’s perspective (no policy lecture)
    const sc = detectScenario(message);
    if (sc){
      return res.status(200).json({ ok: true, reply: tone(sc.speak(message)) });
    }

    // 4) Open, friendly chat relevant to work/life topics
    return res.status(200).json({ ok: true, reply: tone(looseChat(message)) });

  } catch (e){
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
