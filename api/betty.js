// /api/betty.js
// Betty — answer-first with Q&A pairs, then scenarios, then intents.
// Gifts & Hospitality give complete rules (no clarifiers). Others may add ONE short clarifier if needed.
// Works on Vercel (CommonJS). Expects POST { message, history }.

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

const BANK = require("./betty_banks");

/* ========== Utils ========== */
const MAX_SENTENCES = 2;
const MAX_CHARS = 300;

const stopwords = new Set(
  "the a an and or but if then so to of for on in at by from with as is are was were be been being do does did have has had you your we our us it this that those these there here what when where why how can may should could would will".split(
    " "
  )
);

function clamp(t, n) {
  t = (t || "").toString().trim();
  return t.length <= n ? t : t.slice(0, n);
}
function toSentences(s) {
  return (s || "")
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+[.!?]?/g) || [];
}
function capSentences(s, max) {
  return toSentences(s).slice(0, max).join(" ").trim();
}
function tone(s) {
  return clamp(capSentences(s, MAX_SENTENCES), MAX_CHARS);
}

function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9£ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokens(s) {
  const arr = norm(s)
    .split(" ")
    .filter(Boolean)
    .filter((w) => !stopwords.has(w));
  return new Set(arr);
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
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

/* ========== Slot extraction ========== */
// amounts: "£60", "60 quid", "about 45", "roughly £30"
function getAmount(msg) {
  if (!msg) return null;
  const m1 = msg.match(/£\s?(\d{1,5})(?:\.\d{1,2})?/i);
  if (m1) return Math.round(parseFloat(m1[1]));
  const m2 = msg.match(/\b(\d{1,5})\s*(?:quid|pounds|gbp)\b/i);
  if (m2) return parseInt(m2[1], 10);
  const m3 = msg.match(/\b(?:about|around|roughly)\s*£?\s?(\d{1,5})\b/i);
  return m3 ? parseInt(m3[1], 10) : null;
}
const isDuringTender = (m) => /(tender|rfp|bid)/i.test(m || "");
const mentionsOfficial = (m) =>
  /(public\s*official|mayor|council|mp|soe|state[-\s]*owned)/i.test(m || "");
const mentionsGift = (m) =>
  /(gift|hamper|present|bottle|voucher|card)/i.test(m || "");
const mentionsHosp = (m) =>
  /(coffee|lunch|dinner|meal|tickets|event|hospitality|match|game)/i.test(
    m || ""
  );
const mentionsTravel = (m) =>
  /(flight|travel|hotel|accommodation|airfare|lodge|business\s*class|economy)/i.test(
    m || ""
  );
const mentions3P = (m) =>
  /(agent|intermediary|third\s*party|consultant)/i.test(m || "");
const mentionsFacil = (m) =>
  /(facilitation|speed\s*payment|cash\s*(?:to|get)\s*speed|extra\s*fee)/i.test(
    m || ""
  );
const mentionsDonation = (m) => /(donation|sponsorship|charity|csr)/i.test(m || "");
const mentionsRegister = (m) => /(register|log|record|books)/i.test(m || "");

/* ========== Close when learner states a correct rule ========== */
function detectLearnerPolicy(msg) {
  const m = (msg || "").toLowerCase();
  if (
    /(decline|refuse|not accept).*(tender|rfp|bid)|(tender|rfp|bid).*(decline|refuse|not accept)/.test(
      m
    )
  )
    return "I’ll decline anything during a tender and suggest a simple coffee after the award, then make a quick note.";
  if (
    /(facilitation|unofficial).*(refuse|decline|do not pay)|refuse.*(facilitation|unofficial)/.test(
      m
    )
  )
    return "I’ll refuse any ‘speed’ payments; if there’s a genuine safety risk I’ll step away, pay the minimum only if unavoidable, and report right away.";
  if (
    /(pause|hold|stop).*(agent|intermediary|third)|(escalate|compliance|due diligence).*(agent|intermediary|third)/.test(
      m
    )
  )
    return "I’ll pause and escalate to Compliance for due diligence and transparent paperwork, otherwise we’ll step away.";
  if (/(public official|mayor|council|mp)\s*.*(decline|refuse)/.test(m))
    return "I’ll decline the request from the public official and escalate; if we help, I’ll suggest a transparent CSR route.";
  if (/(conflict).*(hr|process)|standard hr|no preferential|no preference/.test(m))
    return "I’ll raise the conflict and route it via the standard HR process with no preferential treatment, and record the decision.";
  if (
    /gift|hamper|present|bottle|card|voucher/i.test(m) &&
    /(accept|okay|fine)/.test(m) &&
    /(£?\s?50|fifty|register|log|g(&|and)h)/.test(m)
  )
    return "I’ll keep any gift modest, within limits, and add it to the G&H Register with a polite note.";
  if (
    /(public official|official|soe|state).*?(token|small|promo).*?(approval|pre-approval|compliance)/.test(
      m
    )
  )
    return "For public officials I’ll keep to token items only, get Compliance pre-approval, and keep a simple distribution list.";
  if (/(economy)/.test(m) && /(agenda|bona fide|company.to.company|company-?to-?company|records|receipts)/.test(m))
    return "I’ll book economy with a clear agenda, keep payments company-to-company, and save tidy records.";
  return null;
}

/* ========== Specific scenarios (before intents) ========== */
const SCENARIOS = [
  {
    id: "tickets_tender",
    match: /ticket|match|football|game/i,
    also: /tender|rfp|bid/i,
    variants: [
      "During tenders we avoid gifts and hospitality—even match tickets. We can meet after the award."
    ]
  },
  {
    id: "customs_speed_cash",
    match: /customs|border|shipment/i,
    also: /cash|speed|fast|quick/i,
    variants: [
      "That sounds like a facilitation payment—I’d refuse and ask for the official process, then report it."
    ]
  },
  {
    id: "agent_offshore",
    match: /agent|intermediary|consultant/i,
    also: /offshore|commission|percent|%/i,
    variants: [
      "Let’s pause and gather proper paperwork; offshore commissions need review before we proceed."
    ]
  }
];
function detectScenario(message) {
  for (const sc of SCENARIOS) {
    if (sc.match.test(message) && (!sc.also || sc.also.test(message))) return sc;
  }
  return null;
}

/* ========== 1) Q&A PAIRS: high-confidence match ========== */
function qaBestMatch(message) {
  const qset = tokens(message);
  let best = null,
    bestScore = 0;

  (BANK.qaPairs || []).forEach((pair) => {
    const t = tokens(pair.q);
    let score = jaccard(qset, t);

    // slot-aware boosts
    const amtQ = getAmount(message),
      amtT = getAmount(pair.q);
    if (amtQ && amtT && Math.abs(amtQ - amtT) <= 5) score += 0.2;
    if (isDuringTender(message) && isDuringTender(pair.q)) score += 0.2;
    if (mentionsOfficial(message) && mentionsOfficial(pair.q)) score += 0.2;

    if (score > bestScore) {
      bestScore = score;
      best = pair;
    }
  });

  const confident = best && bestScore >= 0.55;
  const shortQ = norm(message).split(" ").length <= 9 && bestScore >= 0.4;
  return confident || shortQ ? best : null;
}

/* ========== 2) INTENTS (Gifts & Hospitality are crisp, no clarifiers) ========== */
const INTENTS = [
  // GIFTS — crisp default rule
  {
    id: "gifts",
    match: mentionsGift,
    reply: (msg) => {
      const amt = getAmount(msg);

      if (isDuringTender(msg))
        return "During tenders, no gifts are acceptable—even small ones.";
      if (mentionsOfficial(msg))
        return "For public officials only small token items (~£25) are acceptable and must be declared.";

      if (amt != null) {
        if (amt > 50) return "£" + amt + " is above the limit—best to decline politely.";
        return "£" + amt + " is within the £50 limit—okay to accept if logged in the register.";
      }

      // Default complete rule (no clarifier)
      return "Gifts under £50 can be accepted if logged. Over £50 should be declined. During tenders, decline all gifts.";
    },
    need: () => null
  },

  // HOSPITALITY — crisp default rule
  {
    id: "hospitality",
    match: mentionsHosp,
    reply: (msg) => {
      if (isDuringTender(msg))
        return "During tenders, hospitality isn’t appropriate—even a coffee.";
      return "Reasonable, business-related hospitality is fine if recorded; keep it modest and never during tenders.";
    },
    need: () => null
  },

  // PUBLIC OFFICIALS
  {
    id: "officials",
    match: mentionsOfficial,
    reply: () =>
      "For public officials, keep to small token items (~£25), pre-approve and record them.",
    need: (msg) => (getAmount(msg) == null ? "Is it a small token (around £25 or less)?" : null)
  },

  // FACILITATION
  {
    id: "facilitation",
    match: mentionsFacil,
    reply: () =>
      "Facilitation payments aren’t allowed—refuse and ask for the official process, then report.",
    need: (msg) =>
      /safe|danger|threat|risk/i.test(msg) ? null : "Is there any safety risk if you refuse?"
  },

  // THIRD PARTIES
  {
    id: "thirdParties",
    match: mentions3P,
    reply: () =>
      "Let’s pause and run due diligence; use a clear contract with invoices—no unusual commissions.",
    need: (msg) =>
      /offshore|%|percent|commission|fee/i.test(msg)
        ? null
        : "Did they ask for a commission or unusual payment route?"
  },

  // REGISTER / RECORDS
  {
    id: "register",
    match: mentionsRegister,
    reply: () =>
      "Log gifts and hospitality in the register—even the small ones—so records stay complete.",
    need: () => null
  },

  // TRAVEL
  {
    id: "travel",
    match: mentionsTravel,
    reply: () =>
      "Travel is best kept economy and paid by us; if a supplier offers to cover it, seek approval first.",
    need: (msg) =>
      /(business|economy)/i.test(msg) ? null : "Do you want to keep travel economy and practical?"
  },

  // DONATIONS / SPONSORSHIP
  {
    id: "donations",
    match: mentionsDonation,
    reply: () =>
      "Donations or sponsorships need prior approval and must be transparent; political donations aren’t allowed.",
    need: (msg) =>
      /political/i.test(msg) ? null : "Is this a political donation or general charity support?"
  }
];

/* ========== Compose answer (answer-first; clarifier only if needed & question) ========== */
function composeAnswer(message, history) {
  // Close if learner states a correct rule
  const policy = detectLearnerPolicy(message);
  if (policy) {
    const thanks =
      (BANK.persona?.closes && BANK.persona.closes[0]) ||
      "Thanks Detective — clear.";
    return tone(`${thanks} ${policy}`);
  }

  // Scenarios first
  const sc = detectScenario(message);
  if (sc) return tone(sc.variants[0]);

  // Q&A pairs (highest precision)
  const qa = qaBestMatch(message);
  if (qa) return tone(qa.a);

  // Intents (with cautious clarifiers)
  for (const it of INTENTS) {
    if (it.match(message)) {
      const primary = it.reply(message);
      const missing = typeof it.need === "function" ? it.need(message) : null;
      const wantsClarifier = missing && /\?\s*$/.test(message);
      return tone(wantsClarifier ? `${primary} ${missing}` : primary);
    }
  }

  // Friendly engage fallback
  const opener =
    (BANK.greetings && BANK.greetings[0]) ||
    "Of course — go ahead. What’s on your mind?";
  return tone(opener);
}

/* ========== HTTP handler ========== */
module.exports = function handler(req, res) {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const opener =
      (BANK.persona?.openers && BANK.persona.openers[0]) ||
      "Hi Detective, how can I help?";
    return res.status(200).json({ ok: true, reply: opener });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    let body = req.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const message = (body.message || "").toString().trim();
    const history = (body.history || "").toString();

    if (!message) {
      const opener =
        (BANK.persona?.openers && BANK.persona.openers[0]) ||
        "Hi Detective, how can I help?";
      return res.status(200).json({ ok: true, reply: tone(opener) });
    }

    const reply = composeAnswer(message, history);
    return res.status(200).json({ ok: true, reply });
  } catch (e) {
    return res
      .status(200)
      .json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
