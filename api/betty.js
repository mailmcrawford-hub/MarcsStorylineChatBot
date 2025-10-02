// /api/betty — Open chat; answers the user's last question directly (CommonJS)

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

// ----------------- tone helpers -----------------
const MAX_SENTENCES = 4;
const MAX_CHARS = 380;

function clamp(t, n){ t = (t||"").toString(); return t.length <= n ? t : t.slice(0, n); }
function toSentences(s){ return (s||"").replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]?/g) || []; }
function capSentences(s, max){ return toSentences(s).slice(0, max).join(" ").trim(); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function tone(s){
  let out = s || pick(BETTY.openerVariants);
  if (Math.random() < 0.12 && out.length < 280) out += ` ${pick(BETTY.quirks)}.`;
  return clamp(capSentences(out, MAX_SENTENCES), MAX_CHARS);
}

// ----------------- policy close detection -----------------
function detectLearnerPolicy(msg){
  const m = (msg || "").toLowerCase();
  if (/(decline|refuse|not accept).*(tender|rfp|bid)|(tender|rfp|bid).*(decline|refuse|not accept)/.test(m))
    return "I’ll decline anything while a tender is running and we can meet for a simple coffee after the award. I’ll note it properly.";
  if (/(facilitation|unofficial).*(refuse|decline|do not pay)|refuse.*(facilitation|unofficial)/.test(m))
    return "I’ll refuse any ‘speed’ payments; if there’s a genuine safety risk I’ll step away, pay the minimum only if unavoidable, and report straight away.";
  if (/(pause|hold|stop).*(agent|intermediary|third)| (escalate|compliance|due diligence).*(agent|intermediary|third)/.test(m))
    return "I’ll pause and escalate to Compliance for due diligence and transparent paperwork, otherwise we’ll step away.";
  if (/(public official|mayor|council).*(decline|refuse)/.test(m))
    return "I’ll decline the request from the public official and escalate; if we help, I’ll suggest a transparent CSR route.";
  if (/(conflict).*(hr|process)|standard hr|no preferential|no preference/.test(m))
    return "I’ll surface the conflict and route it through the standard HR process with no preferential treatment, and record the decision.";
  if (/gift|hamper|present|bottle|card|voucher/i.test(m) && /(accept|okay|fine)/.test(m) && /(£?\s?50|fifty|register|log|g(&|and)h)/.test(m))
    return "I’ll only accept if it’s modest, keep it within limits, and log it in the G&H Register with a polite note.";
  if (/(public official|official|soe|state).*?(token|small|promo).*?(approval|pre-approval|compliance)/.test(m))
    return "For public officials I’ll keep to token items only and get Compliance pre-approval, with a simple distribution list.";
  if (/(economy)/.test(m) && /(agenda|bona fide|company.to.company|company-?to-?company|records|receipts)/.test(m))
    return "I’ll book economy with a clear agenda, keep payments company-to-company, and save tidy records.";
  return null;
}

// ----------------- scenarios (Betty describes, asks for direction) ----------
const SCENARIOS = [
  { key: "tickets_tender",
    match: /ticket|match|football|game/i, also: /tender|rfp|bid/i,
    speak: () => "A supplier offered football tickets while we’re mid-bid. I can suggest a simple catch-up after the award if you prefer." },
  { key: "customs_speed_cash",
    match: /customs|border|shipment/i, also: /cash|speed|fast|quick/i,
    speak: () => "Someone at the border hinted £20 would speed things up. I can ask for the official route or step away if it feels off." },
  { key: "agent_offshore",
    match: /agent|intermediary|consultant/i, also: /offshore|commission|percent|%/i,
    speak: () => "An agent wants 15% paid to an offshore account. I can pause it and gather their paperwork if you want to look." },
  { key: "mayor_fund",
    match: /mayor|permit|council|official/i, also: /fund|donation|£|2,?000|2000/i,
    speak: () => "The mayor’s office mentioned a £2,000 ‘community fund’ linked to our permit. How would you like me to respond?" },
  { key: "client_cousin_hire",
    match: /hire|cousin|relative|nephew|niece|family/i, also: /client|customer/i,
    speak: () => "A client asked us to hire their cousin. I’m happy to pass on the CV and keep the process neat if that helps." },
  { key: "hamper_30",
    match: /hamper|gift|present|bottle|rioja|voucher|card/i,
    speak: () => "A vendor sent a small hamper, roughly £30. I can send thanks and note it, or return it if you’d rather." },
  { key: "soe_tote",
    match: /tote|bag|swag|promo|souvenir/i, also: /soe|state|official|delegates|public/i,
    speak: () => "We have simple totes for visitors from a state-owned firm. Happy to hand them out and keep a quick list if you need it." },
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

// ----------------- direct answers for questions -----------------
function isQuestion(msg){ return /\?\s*$/.test(msg || ""); }

function directAnswer(msg){
  const m = (msg||"").toLowerCase();

  // Small talk questions
  if (/how are you|how’s it going|you ok|are you well/.test(m))
    return "I’m good, thank you. What would you like me to look into?";

  // Topic questions
  if (/should.*(accept|take).*(gift|hamper|present|bottle)/.test(m))
    return `If you’re comfortable with it, I can keep it modest (around £${LIMITS.gift}) and make a note, or I can return it — your call.`;
  if (/(what|how).*(g(&|and)h|register|log|record)/.test(m))
    return "I can add a short entry with who, what, rough value and date. Would you like me to do that?";
  if (/can.*(we|you).*(meet|coffee|lunch|dinner|tickets|event)/.test(m))
    return "I’m happy with a simple coffee or a low-key meet-up. If timing feels awkward, we can set it after any decisions.";
  if (/what.*(about|re).*public.*official|mayor|council/.test(m))
    return "I can keep it very modest and clear, and check with you before giving anything. Do you want me to keep a small list of who gets what?";
  if (/how.*travel|can.*book.*(business|economy)/.test(m))
    return "I can keep travel simple and practical; economy works for me. Would you like me to arrange it?";
  if (/agent|intermediary|third.*party.*(ok|normal|do)/.test(m))
    return "I can pause to gather their details and paperwork so you can review. Shall I ask them for that?";
  if (/donation|sponsorship|charity|csr.*(ok|how|can)/.test(m))
    return "I can ask about a transparent route if you want to support something locally. Do you want me to enquire?";

  // Generic question fallback, but **answer it**, no mirroring
  return "I can help with that. Tell me how you’d like me to proceed and I’ll do it.";
}

// ----------------- friendly statements (no mirroring/quotes) -----------------
function friendlyStatementReply(msg){
  const m = (msg||"").toLowerCase();
  if (/travel|flight|hotel|expenses/.test(m))
    return "I travel now and then for demos and keep plans simple so they’re easy to explain later. What would you like me to set up?";
  if (/client|prospect|meeting|demo/.test(m))
    return "With clients I like a clear agenda and honest chat so we get to the point. Where shall we start?";
  if (/register|record|log|books/.test(m))
    return "I can note things down neatly if you want a record. What would you like captured?";
  if (/agent|intermediary|third party|due diligence/.test(m))
    return "I can collect straightforward paperwork and contacts from the agent if you want to review them.";
  if (/donation|sponsorship|charity|csr/.test(m))
    return "If there’s a community angle I can ask the right questions and keep it transparent. How would you like me to put it?";
  if (/conflict|relative|cousin|friend/.test(m))
    return "If there’s a personal link I’ll mention it openly so everyone is comfortable. What should I do next?";
  return "Happy to help. What would you like me to do?";
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

    const message = (body.message || "").toString().trim();
    if (!message){
      return res.status(200).json({ ok: true, reply: tone(pick(BETTY.openerVariants)) });
    }

    // 1) Close if learner states a correct rule/policy
    const close = detectLearnerPolicy(message);
    if (close){
      return res.status(200).json({ ok: true, reply: tone(`Thanks Detective — that’s clear. ${close}`) });
    }

    // 2) Scenario-specific reply if detected
    const sc = detectScenario(message);
    if (sc){
      return res.status(200).json({ ok: true, reply: tone(sc.speak(message)) });
    }

    // 3) Small talk
    if (/[?]/.test(message) && /(how are you|how’s it going|you ok|are you well)/i.test(message)){
      return res.status(200).json({ ok: true, reply: tone("I’m good, thank you. What would you like me to look into?") });
    }

    // 4) Direct Q&A vs friendly statement (no echoes)
    if (isQuestion(message)){
      return res.status(200).json({ ok: true, reply: tone(directAnswer(message)) });
    } else {
      return res.status(200).json({ ok: true, reply: tone(friendlyStatementReply(message)) });
    }

  } catch (e){
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
