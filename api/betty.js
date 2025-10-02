// /api/betty — Freer Betty persona (CommonJS). Chatty, UK tone, still ABC-relevant.

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
    "I keep a tiny paper diary with sticky notes",
    "I’m partial to a flat white before client calls",
    "I once logged a small hamper after a demo, just to be safe"
  ],
  opener: "Hi, I’m Betty from Acme. Happy to chat through gifts, hospitality and ABC."
};

// --- Scenarios (same topics, but more conversational copy) -----------------
const SCENARIOS = [
  {
    key: "tickets_tender",
    match: /ticket|match|football|game/i,
    also: /tender|rfp|bid/i,
    chat: (m) =>
      "Football tickets during a live tender raise eyebrows, mainly the perception we’re being influenced. I usually park hospitality until the award, then offer a low-key coffee or a short catch-up and log it properly.",
    ask: "What would you do with the offer in your case?"
  },
  {
    key: "customs_speed_cash",
    match: /customs|border|shipment/i,
    also: /cash|speed|fast|quick/i,
    chat: () =>
      "Those little ‘speed’ requests at borders crop up now and then. I ask for the official process or a receipt; if there’s any hint of safety risk, I get out and escalate, and only pay the bare minimum if it’s truly unavoidable then report it quickly.",
    ask: "How would you steer that conversation at the counter?"
  },
  {
    key: "agent_offshore",
    match: /agent|intermediary|consultant/i,
    also: /offshore|commission|percent|%/i,
    chat: () =>
      "An offshore commission needs a pause. We do risk-based due diligence, make the scope clear, and pay a named company to a normal account against proper invoices. If that can’t be satisfied, we walk away.",
    ask: "What checks would you want me to run first?"
  },
  {
    key: "mayor_fund",
    match: /mayor|permit|council|official/i,
    also: /fund|donation|£|2,?000|2000/i,
    chat: () =>
      "Money linked to a permit from a public official is a red flag. I’d decline and escalate; if we want to support the community we do it as a transparent CSR activity, not tied to a decision.",
    ask: "How would you frame the decline so it stays professional?"
  },
  {
    key: "client_cousin_hire",
    match: /hire|cousin|relative|nephew|niece|family/i,
    also: /client|customer/i,
    chat: () =>
      "A client pushing a relative can look like a sweetener. I call out the conflict, route the role through normal HR, and document the decision so it’s fair and based on merit.",
    ask: "What would you tell the client so expectations stay clear?"
  },
  {
    key: "hamper_30",
    match: /hamper|gift|present|bottle|rioja|voucher|card/i,
    chat: () =>
      `A small hamper around £30 is usually fine if there's no tender running and no intent to sway us. I thank them, keep it modest, and log it in the G&H Register so our books stay tidy.`,
    ask: "Would you accept in your example, or prefer I return it?"
  },
  {
    key: "soe_tote",
    match: /tote|bag|swag|promo|souvenir/i,
    also: /soe|state|official|delegates|public/i,
    chat: () =>
      "For public officials we keep to token items, like simple totes or pens, and we get Compliance pre-approval. A short distribution list helps if anyone asks later.",
    ask: "What would you want captured on that list?"
  },
  {
    key: "business_class",
    match: /flight|travel|hotel|business class|business-class/i,
    chat: () =>
      "For travel I stick to economy and a clear business agenda. Company-to-company payment and neat receipts keep it clean and easy to justify.",
    ask: "How strict would you be on exceptions, say for medical needs?"
  }
];

// ---------- utilities ----------
const MAX_SENTENCES = 4;
const MAX_CHARS = 400;

function clamp(text, n) { text = (text || "").toString(); return text.length <= n ? text : text.slice(0, n); }
function toSentences(s) { return (s||"").replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]?/g) || []; }
function capSentences(s, max) { return toSentences(s).slice(0, max).join(" ").trim(); }

function cleanQuote(msg) {
  // Reduce odd echoes like “what was worth”
  return (msg || "")
    .replace(/["“”]+/g, "")
    .replace(/[^a-z0-9£\s.,!?()-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bettyTone(s) {
  // Freer, warmer tone; may add a small human detail occasionally
  let out = s || BETTY.opener;
  if (Math.random() < 0.2 && out.length < 280) {
    const q = BETTY.quirks[Math.floor(Math.random()*BETTY.quirks.length)];
    out += ` ${q}.`;
  }
  return clamp(capSentences(out, MAX_SENTENCES), MAX_CHARS);
}

function detectScenario(msg) {
  for (const sc of SCENARIOS) {
    if (sc.match.test(msg) && (!sc.also || sc.also.test(msg))) return sc;
  }
  return null;
}

function turnsSoFar(history) {
  if (!history) return 0;
  return Math.max(0, Math.min(history.split(/\r?\n/).filter(l => /^You:\s/i.test(l)).length, 10));
}

// ---------- conversational replies ----------
function smallTalk(msg) {
  const m = msg.toLowerCase();
  return /(hello|hi|morning|afternoon|how are you|who are you|your role|where.*from)/i.test(m);
}
function smallTalkReply() {
  return "Hello! I’m Betty in Sales up in Manchester. Ask away and I’ll keep it practical and policy-aware.";
}

function looseTopicReply(msg) {
  const m = msg.toLowerCase();
  if (/travel|flight|hotel|expenses/.test(m))
    return "I travel for demos a fair bit; keeping it economy with tidy receipts makes life easier if anyone asks later.";
  if (/client|prospect|meeting|demo/.test(m))
    return "Clients like a clear agenda and next steps. I keep hospitality modest so it doesn’t distract from the work.";
  if (/register|record|log|books/.test(m))
    return "I log items of value in the G&H Register—takes seconds and saves questions down the line.";
  if (/agent|intermediary|third party|due diligence/.test(m))
    return "With third parties I like simple scopes, due diligence, and clean invoices to a normal account.";
  if (/donation|sponsorship|charity|csr/.test(m))
    return "Donations go through Compliance and to organisations, not people; it keeps motives clear.";
  if (/conflict|relative|cousin|friend/.test(m))
    return "If there’s a personal link, I surface the conflict early and let the standard process do its thing.";
  return null;
}

function conversationalFallback(msg) {
  const cleaned = cleanQuote(msg);
  const echo = cleaned ? `On “${cleaned}”, ` : "";
  const base = looseTopicReply(msg) ||
    "from experience I keep things modest, logged and transparent so decisions stand on their own merits.";
  // Only sometimes add a question to keep flow natural
  const maybeQ = Math.random() < 0.5 ? " What would you do in that situation?" : "";
  return `${echo}${base}${maybeQ}`;
}

// ---------- scenario flow (more relaxed) ----------
function scenarioFlow(sc, userMsg, history) {
  const t = turnsSoFar(history);
  // Stage 0: share context freely
  if (t <= 0) return sc.chat(userMsg);
  // Stage 1: add detail + invite the learner
  if (t === 1) return sc.chat(userMsg) + " " + sc.ask;
  // Stage 2+: keep it conversational; ask once in a while
  if (t % 2 === 0) return sc.chat(userMsg);
  return sc.ask;
}

// ---------- HTTP handler ----------
module.exports = function handler(req, res) {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, reply: BETTY.opener });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    let body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

    const message = (body.message || "").toString().trim();
    const history = (body.history || "").toString();

    if (!message) {
      return res.status(200).json({ ok: true, reply: bettyTone(BETTY.opener) });
    }

    if (smallTalk(message)) {
      return res.status(200).json({ ok: true, reply: bettyTone(smallTalkReply()) });
    }

    const sc = detectScenario(message);
    if (sc) {
      const reply = scenarioFlow(sc, message, history);
      return res.status(200).json({ ok: true, reply: bettyTone(reply) });
    }

    const reply = conversationalFallback(message);
    return res.status(200).json({ ok: true, reply: bettyTone(reply) });

  } catch (e) {
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
