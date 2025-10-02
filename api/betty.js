// Betty — intent-first, deterministic replies with targeted clarifier when info is missing.
// Answers the last learner input, then (if needed) adds ONE short clarifier relevant to ABC.
// CommonJS + CORS (works on Vercel). Expects POST { message, history }.

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

/* ---------------- Banks (verbatim authored lines live here) ---------------- */
const BANK = require("./betty_banks"); // keep your existing banks file

/* ---------------- Utils ---------------- */
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
  for (const ln of lines) { const m = ln.match(/^Betty:\s*(.+)$/i); if (m) return m[1].trim(); }
  return "";
}

/* ---------------- Slot extraction ---------------- */
function getAmount(msg){ const m=(msg||"").match(/£\s?(\d{1,5})/i); return m?parseInt(m[1],10):null; }
function isDuringTender(msg){ return /(tender|rfp|bid)/i.test(msg||""); }
function mentionsOfficial(msg){ return /(public\s*official|mayor|council|soe|state[-\s]*owned)/i.test(msg||""); }
function mentionsGift(msg){ return /(gift|hamper|present|bottle|voucher|card)/i.test(msg||""); }
function mentionsHospitality(msg){ return /(coffee|lunch|dinner|meal|tickets|event|hospitality)/i.test(msg||""); }
function mentionsTravel(msg){ return /(flight|travel|hotel|accommodation|airfare|lodge|book.*(business|economy))/i.test(msg||""); }
function mentionsThirdParty(msg){ return /(agent|intermediary|third\s*party|consultant)/i.test(msg||""); }
function mentionsFacilitation(msg){ return /(facilitation|speed\s*payment|cash\s*(to|get)\s*speed|extra\s*fee)/i.test(msg||""); }
function mentionsDonation(msg){ return /(donation|sponsorship|charity|csr)/i.test(msg||""); }
function mentionsRegister(msg){ return /(register|log|record|books)/i.test(msg||""); }

/* ---------------- Conversation close on correct policy ---------------- */
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

/* ---------------- Scenarios (specific before intents) ---------------- */
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
  for (const sc of SCENARIOS){ if (sc.match.test(message) && (!sc.also || sc.also.test(message))) return sc; }
  return null;
}

/* ---------------- Intent map using banks ---------------- */
const INTENTS = [
  { id: "engage",        match: /(can we talk|can i ask|can we chat|are you free|got a minute|quick question|can i run something by you)/i,
    reply: (msg,key) => pickDet(BANK.greetings, key),
    clarify: null
  },
  { id: "gifts",         match: /(gift|hamper|present|bottle|voucher|card)/i,
    reply: (msg,key) => {
      if (isDuringTender(msg)) return pickDet(BANK.tender, key);
      if (mentionsOfficial(msg)) return pickDet(BANK.officials, key);
      const amt = getAmount(msg);
      if (amt && amt > 50) return "Anything above £50 is too much — best to decline kindly.";
      return pickDet(BANK.gifts, key);
    },
    clarify: (msg) => {
      if (!isDuringTender(msg)) return "Is this during a live tender, or in general?";
      if (!mentionsOfficial(msg)) return "Does this involve a public official?";
      if (!getAmount(msg)) return "Roughly how much is it worth?";
      return null;
    }
  },
  { id: "hospitality",   match: /(coffee|lunch|dinner|meal|tickets|event|hospitality)/i,
    reply: (msg,key) => isDuringTender(msg) ? pickDet(BANK.tender, key) : pickDet(BANK.hospitality, key),
    clarify: (msg) => {
      if (!isDuringTender(msg)) return "Is this while a tender is running, or outside of one?";
      return null;
    }
  },
  { id: "officials",     match: /(public\s*official|mayor|council|soe|state[-\s]*owned)/i,
    reply: (msg,key) => pickDet(BANK.officials, key),
    clarify: (msg) => (!getAmount(msg) ? "Is it a small token item (around £25 or less)?" : null)
  },
  { id: "facilitation",  match: /(facilitation|speed\s*payment|cash\s*(to|get)\s*speed|extra\s*fee)/i,
    reply: (msg,key) => pickDet(BANK.facilitation, key),
    clarify: (msg) => /safe|danger|threat|risk/i.test(msg) ? null : "Is there any safety risk if you refuse?"
  },
  { id: "thirdParties",  match: /(agent|intermediary|third\s*party|consultant)/i,
    reply: (msg,key) => pickDet(BANK.thirdParties, key),
    clarify: (msg) => /offshore|%|percent|commission|fee/i.test(msg) ? null : "Did they ask for a commission or unusual payment route?"
  },
  { id: "register",      match: /(register|log|record|books)/i,
    reply: (msg,key) => pickDet(BANK.register, key),
    clarify: null
  },
  { id: "travel",        match: /(flight|travel|hotel|accommodation|airfare|lodge|book.*(business|economy))/i,
    reply: (msg,key) => pickDet(BANK.travel, key),
    clarify: (msg) => /(business|economy)/i.test(msg) ? null : "Do you want to keep travel economy and practical?"
  },
  { id: "donations",     match: /(donation|sponsorship|charity|csr)/i,
    reply: (msg,key) => pickDet(BANK.donations, key),
    clarify: (msg) => /political/i.test(msg) ? null : "Is this a political donation or general charity support?"
  },
  { id: "conflicts",     match: /(conflict|relative|cousin|family|friend)/i,
    reply: (msg,key) => pickDet(BANK.conflicts, key),
    clarify: (msg) => /client|supplier|manager/i.test(msg) ? null : "Whose relative is it — client, supplier, or someone internal?"
  }
];

/* ---------------- Build response + optional clarifier ---------------- */
function answerWithOptionalClarifier(message, history){
  // 1) Scenarios first
  const sc = detectScenario(message);
  if (sc){
    const out = pickDet(sc.variants, message + "|" + lastBetty(history));
    return tone(out); // scenario replies are already specific; no clarifier
  }

  // 2) Intents
  const key = message + "|" + lastBetty(history);
  for (const it of INTENTS){
    if (it.match.test(message)){
      const primary = it.reply(message, key) || "";
      let clarifier = null;

      // Clarifier appears ONLY when intent has missing critical info
      if (typeof it.clarify === "function"){
        clarifier = it.clarify(message);
      }

      // Format: answer first, then—if needed—ONE short clarifying question
      const reply = clarifier ? `${primary} ${clarifier}` : primary;
      return tone(reply);
    }
  }

  // 3) Fallback: warm engage from greetings
  return tone(pickDet(BANK.greetings, "fallback"));
}

/* ---------------- HTTP Handler ---------------- */
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

    // Close warmly if the learner states a correct rule/policy
    const close = detectLearnerPolicy(message);
    if (close){
      const thanks = pickDet(BANK.persona.closes, history.length + "|" + message);
      return res.status(200).json({ ok: true, reply: tone(`${thanks} ${close}`) });
    }

    // Answer + (if needed) one clarifier
    const reply = answerWithOptionalClarifier(message, history);
    return res.status(200).json({ ok: true, reply });

  } catch (e){
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
