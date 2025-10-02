// /api/betty — Open chat v2: direct, topic-aware answers; no generic fallback loops (CommonJS)

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

// ---------- pull the last thing Betty said to avoid repeats ----------
function lastBetty(history) {
  if (!history) return "";
  const lines = history.split(/\r?\n/).reverse();
  for (const ln of lines) {
    const m = ln.match(/^Betty:\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return "";
}

// ---------- policy close detection ----------
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

// ---------- scenarios (Betty describes neutrally, asks for direction only if asked) ----------
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

// ---------- direct answers for questions (topic-aware, varied, no “tell me how”) ----------
function answerQuestion(msg){
  const m = (msg||"").toLowerCase();

  // Small talk
  if (/how are you|how’s it going|you ok|are you well/.test(m))
    return pick(["I’m good, thank you.", "All well here, thanks.", "Doing fine today, thanks."]);

  // Gifts
  if (/should.*(accept|take).*(gift|hamper|present|bottle|voucher|card)/.test(m))
    return pick([
      `If you’re comfortable, I’ll keep it modest (around £${LIMITS.gift}) and make a short note.`,
      "I can send thanks and keep it simple, or return it if you’d rather.",
      "Happy to accept if it’s small and sensible, otherwise I’ll decline politely."
    ]);

  // Register / records
  if (/(what|how).*(g(&|and)h|register|log|record)/.test(m))
    return pick([
      "I’ll note who it was from, a brief description, rough value and the date.",
      "I can add a short entry with names, item, estimate and when it happened.",
      "I’ll keep a neat line in the register so it’s easy to check later."
    ]);

  // Meetings / hospitality
  if (/can.*(we|you).*(meet|coffee|lunch|dinner|tickets|event)/.test(m))
    return pick([
      "A simple coffee works well; I’ll keep it low-key.",
      "Yes, I can set up a short catch-up that feels comfortable.",
      "Happy to meet — I’ll keep it straightforward."
    ]);

  // Public officials
  if (/(what|how).*(public.*official|mayor|council)/.test(m))
    return pick([
      "I’ll keep it very modest and clear, and check with you before giving anything.",
      "I can keep it token-level and make sure it’s transparent.",
      "Happy to keep it simple and documented if needed."
    ]);

  // Travel
  if (/how.*travel|can.*book.*(business|economy)/.test(m))
    return pick([
      "I can keep travel simple — economy is fine.",
      "I’ll book something practical and tidy on receipts.",
      "Happy with economy and a clear agenda."
    ]);

  // Third parties
  if (/agent|intermediary|third.*party.*(ok|normal|do|should)/.test(m))
    return pick([
      "I can pause and gather their details and paperwork.",
      "I’ll ask for a straightforward contract and invoices for you to review.",
      "Happy to collect the basics so you can take a view."
    ]);

  // Donations / sponsorship
  if (/donation|sponsorship|charity|csr.*(ok|how|can|should)/.test(m))
    return pick([
      "I can enquire about a transparent route if you want to support something locally.",
      "Happy to ask a few questions and keep it above board.",
      "I’ll check options and keep it tidy."
    ]);

  // Generic question → give a helpful answer, not a deflection
  return pick([
    "I can handle that and keep it straightforward.",
    "Happy to do that and keep it neat.",
    "I can sort that and keep things simple."
  ]);
}

// ---------- friendly statements (no echoes; never ask for direction unless asked) ----------
function replyToStatement(msg){
  const m = (msg||"").toLowerCase();
  if (/travel|flight|hotel|expenses/.test(m))
    return pick(["I travel for demos now and then and keep plans simple.", "I’ll keep bookings practical and tidy on receipts."]);
  if (/client|prospect|meeting|demo/.test(m))
    return pick(["I like a clear agenda so we get to the point.", "Happy to keep meetings focused and friendly."]);
  if (/register|record|log|books/.test(m))
    return pick(["I’ll keep notes neat so they’re easy to check later.", "I can add concise entries to the register."]);
  if (/agent|intermediary|third party|due diligence/.test(m))
    return pick(["I’ll collect straightforward paperwork from the agent.", "I can ask for simple details and contacts to review."]);
  if (/donation|sponsorship|charity|csr/.test(m))
    return pick(["I’ll enquire politely and keep it transparent.", "Happy to check options and keep it above board."]);
  if (/conflict|relative|cousin|friend/.test(m))
    return pick(["I’ll mention any personal link openly so everyone’s comfortable.", "I’ll flag the connection so decisions stay clean."]);
  return pick(["Understood.", "Got it.", "Thanks for that."]);
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

    // 0) If the learner states a correct rule/policy → warm close
    const close = detectLearnerPolicy(message);
    if (close){
      const final = "Thanks Detective — that’s clear. " + close;
      return res.status(200).json({ ok: true, reply: tone(final) });
    }

    // 1) Scenario-specific if matched
    const sc = detectScenario(message);
    if (sc){
      let resp = sc.speak(message);
      const prev = lastBetty(history);
      if (prev && resp.slice(0, 25) === prev.slice(0, 25)) {
        // vary a little to avoid repeated feel
        resp += " I can keep it straightforward.";
      }
      return res.status(200).json({ ok: true, reply: tone(resp) });
    }

    // 2) Question vs statement
    let reply = /\?\s*$/.test(message) ? answerQuestion(message) : replyToStatement(message);

    // 3) Anti-repeat: if same as last reply, vary wording
    const last = lastBetty(history);
    if (last && reply && reply.toLowerCase() === last.toLowerCase()) {
      reply = pick([
        "Happy to.",
        "No problem.",
        "Alright, I can do that."
      ]);
    }

    return res.status(200).json({ ok: true, reply: tone(reply) });

  } catch (e){
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
