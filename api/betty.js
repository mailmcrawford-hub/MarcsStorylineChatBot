// Intent-first, deterministic router for Betty (uses the banks).
// Answers the learner’s actual question, ends when learner states the correct rule.
// CommonJS for Vercel.

/* -------------------- CORS -------------------- */
function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

/* -------------------- Banks ------------------- */
const BANK = require("./betty_banks");

/* -------------------- Utils ------------------- */
const MAX_SENTENCES = 3;
const MAX_CHARS = 360;

function clamp(t, n){ t = (t||"").toString(); return t.length <= n ? t : t.slice(0, n); }
function toSentences(s){ return (s||"").replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]?/g) || []; }
function capSentences(s, max){ return toSentences(s).slice(0, max).join(" ").trim(); }
function tone(s){ return clamp(capSentences(s, MAX_SENTENCES), MAX_CHARS); }
function hash(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function pickDet(arr, key){ if (!arr || !arr.length) return ""; return arr[hash(String(key)) % arr.length]; }
function lastBetty(history) {
  if (!history) return "";
  const lines = history.split(/\r?\n/).reverse();
  for (const ln of lines) {
    const m = ln.match(/^Betty:\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return "";
}

/* -------------------- Slot helpers ------------------- */
function getAmount(msg){ const m=(msg||"").match(/£\s?(\d{1,5})/i); return m?parseInt(m[1],10):null; }
function isDuringTender(msg){ return /(tender|rfp|bid)/i.test(msg||""); }
function mentionsOfficial(msg){ return /(public\s*official|mayor|council|soe|state[-\s]*owned)/i.test(msg||""); }

/* -------------------- Close when learner states correct policy ------------------- */
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

/* -------------------- Scenario rules (specific first) ------------------- */
const SCENARIOS = [
  { id:"tickets_tender", match:/ticket|match|football|game/i, also:/tender|rfp|bid/i,
    variants:[
      "A supplier offered football tickets while we’re mid-bid. The timing feels sensitive; I can suggest a simple catch-up after the award.",
      "I’ve been offered about £180 in match tickets during a live tender. Happy to park hospitality till later if you prefer.",
      "Tickets popped up while we’re bidding — generous but awkward timing. We could meet after the decision instead."
    ] },
  { id:"customs_speed_cash", match:/customs|border|shipment/i, also:/cash|speed|fast|quick/i,
    variants:[
      "Someone at the border hinted £20 would ‘speed things up’. I can ask for the official route or step away if it feels off.",
      "At customs I was nudged for a small ‘fee’ to hurry a shipment. I can push for the proper process instead.",
      "A guard suggested a quick cash payment to move things along. I can decline and look for the formal path."
    ] },
  { id:"agent_offshore", match:/agent|intermediary|consultant/i, also:/offshore|commission|percent|%/i,
    variants:[
      "An agent wants 15% paid to an offshore account. I can pause it and gather their paperwork for review.",
      "I’ve been asked for a 15% commission via an offshore entity. I can hold while we check them properly.",
      "The intermediary asked for offshore payment details. I’ll collect documents if you want to take a view."
    ] }
];
function detectScenario(message){
  for (const sc of SCENARIOS){
    if (sc.match.test(message) && (!sc.also || sc.also.test(message))) return sc;
  }
  return null;
}

/* -------------------- Intent map (uses your banks) ------------------- */
const INTENTS = [
  {
    id: "engage",
    match: /(can we talk|can i ask|can we chat|are you free|got a minute|quick question|can i run something by you)/i,
    reply: (msg, key) => pickDet(BANK.greetings, key) // warm invite from greeting bank
  },
  {
    id: "gifts",
    match: /(gift|hamper|present|bottle|voucher|card)/i,
    reply: (msg, key) => {
      if (isDuringTender(msg)) return pickDet(BANK.tender, key);
      const amt = getAmount(msg);
      if (amt && amt > 50) return "Anything above £50 is too much — best to decline kindly.";
      if (mentionsOfficial(msg)) return pickDet(BANK.officials, key);
      return pickDet(BANK.gifts, key);
    }
  },
  {
    id: "hospitality",
    match: /(coffee|lunch|dinner|meal|tickets|event|hospitality)/i,
    reply: (msg, key) => isDuringTender(msg) ? pickDet(BANK.tender, key) : pickDet(BANK.hospitality, key)
  },
  {
    id: "officials",
    match: /(public\s*official|mayor|council|soe|state[-\s]*owned)/i,
    reply: (msg, key) => pickDet(BANK.officials, key)
  },
  {
    id: "facilitation",
    match: /(facilitation|speed\s*payment|cash\s*(to|get)\s*speed|extra\s*fee)/i,
    reply: (msg, key) => pickDet(BANK.facilitation, key)
  },
  {
    id: "thirdParties",
    match: /(agent|intermediary|third\s*party|consultant)/i,
    reply: (msg, key) => pickDet(BANK.thirdParties, key)
  },
  {
    id: "register",
    match: /(register|log|record|books)/i,
    reply: (msg, key) => pickDet(BANK.register, key)
  },
  {
    id: "travel",
    match: /(flight|travel|hotel|accommodation|airfare|lodge|book.*(business|economy))/i,
    reply: (msg, key) => pickDet(BANK.travel, key)
  },
  {
    id: "donations",
    match: /(donation|sponsorship|charity|csr)/i,
    reply: (msg, key) => pickDet(BANK.donations, key)
  },
  {
    id: "conflicts",
    match: /(conflict|relative|cousin|family|friend)/i,
    reply: (msg, key) => pickDet(BANK.conflicts, key)
  }
];

/* -------------------- Handler ------------------- */
module.exports = function handler(req, res){
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET"){
    const opener = pickDet(BANK.persona.openers, "get");
    return res.status(200).json({ ok: true, reply: opener });
  }
  if (req.method !== "POST"){
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    let body = req.body || {};
    if (typeof body === "string"){ try { body = JSON.parse(body); } catch { body = {}; } }

    const message = (body.message || "").toString().trim();
    const history = (body.history || "").toString();
    if (!message){
      const opener = pickDet(BANK.persona.openers, "empty");
      return res.status(200).json({ ok: true, reply: tone(opener) });
    }

    // 0) Close if learner states a correct policy/rule
    const close = detectLearnerPolicy(message);
    if (close){
      const thanks = pickDet(BANK.persona.closes, history.length + "|" + message);
      return res.status(200).json({ ok: true, reply: tone(`${thanks} ${close}`) });
    }

    // 1) Scenario first (most specific)
    const sc = detectScenario(message);
    if (sc){
      const prev = lastBetty(history);
      const resp = pickDet(sc.variants, message + "|" + prev);
      return res.status(200).json({ ok: true, reply: tone(resp) });
    }

    // 2) Intents (answer the actual question/topic)
    const key = message + "|" + lastBetty(history);
    for (const intent of INTENTS){
      if (intent.match.test(message)) {
        const out = intent.reply(message, key);
        return res.status(200).json({ ok: true, reply: tone(out) });
      }
    }

    // 3) If totally unknown → friendly greeting prompt (bank)
    const fallback = pickDet(BANK.greetings, "fallback");
    return res.status(200).json({ ok: true, reply: tone(fallback) });

  } catch (e){
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
