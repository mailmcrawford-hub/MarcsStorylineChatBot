// /api/betty — Betty persona + ABC scenarios + probing flow (CommonJS)

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

const LIMITS = { gift: 50, giftPublicOfficial: 25, hospitality: 200 };

const SCENARIOS = [
  {
    key: "tickets_tender",
    match: /ticket|match|football|game/i,
    also: /tender|rfp|bid/i,
    probes: [
      "It’s during a live tender and the tickets are about £180—what risk do you see?",
      "If I wanted to keep the relationship warm, what compliant alternative could I suggest?"
    ],
    expectPolicy: (msg) => /decline|not accept|refus(e|al)/i.test(msg) && /(tender|rfp|bid)/i.test(msg),
    positiveClose: "Agreed. We decline all gifts or hospitality during tenders; offer a simple coffee after the award and log anything in the G&H Register."
  },
  {
    key: "customs_speed_cash",
    match: /customs|border|shipment/i,
    also: /cash|speed|fast|quick/i,
    probes: [
      "They asked for £20 to 'speed it up'—what does our policy call that?",
      "If there’s no safety risk, what should I do instead?"
    ],
    expectPolicy: (msg) =>
      /(facilitation|unofficial)/i.test(msg) &&
      /(refuse|decline|do not pay)/i.test(msg),
    positiveClose: "Right. That’s a facilitation payment—we refuse and ask for the official process; only pay the minimum if there’s a genuine safety risk and report within 24 hours."
  },
  {
    key: "agent_offshore",
    match: /agent|intermediary|consultant/i,
    also: /offshore|commission|percent|%/i,
    probes: [
      "They want 15% to an offshore entity—what’s our first step?",
      "What contract or records would make this transparent?"
    ],
    expectPolicy: (msg) => /(pause|hold|stop)/i.test(msg) && /(escalate|compliance|due diligence)/i.test(msg),
    positiveClose: "Yes. We pause and escalate to Compliance for due diligence and a transparent contract with proper invoices, or we disengage."
  },
  {
    key: "mayor_fund",
    match: /mayor|permit|council|official/i,
    also: /fund|donation|£|2,?000|2000/i,
    probes: [
      "It’s a request tied to a permit by a public official—what’s the issue?",
      "If we want to support the community, what compliant route could we use?"
    ],
    expectPolicy: (msg) => /(decline|refuse)/i.test(msg) && /(public official|official)/i.test(msg),
    positiveClose: "Correct. We decline improper requests from public officials and escalate; a compliant CSR route is the alternative."
  },
  {
    key: "client_cousin_hire",
    match: /hire|cousin|relative|nephew|niece|family/i,
    also: /client|customer/i,
    probes: [
      "They’re nudging to hire a cousin—what risk is that?",
      "How do we handle the hiring decision to keep it clean?"
    ],
    expectPolicy: (msg) =>
      /(conflict)/i.test(msg) &&
      /(standard|normal)\s*hr|hr process|no preferential/i.test(msg),
    positiveClose: "Exactly. It’s a conflict risk—route via the standard HR process with no preferential treatment and document the decision."
  },
  {
    key: "hamper_30",
    match: /hamper|gift|present|bottle|rioja|voucher|card/i,
    probes: [
      "It’s about £30 and there’s no live tender—what limits apply?",
      "What should I do administratively if I accept?"
    ],
    expectPolicy: (msg) =>
      /(accept|okay|fine)/i.test(msg) &&
      /(limit|£?50|fifty)/i.test(msg) &&
      /(register|log|g(&|and)h)/i.test(msg),
    positiveClose: "Spot on. Acceptable within limits (≤ £50), not during tenders, and we log it in the G&H Register with a polite policy-aware thanks."
  },
  {
    key: "soe_tote",
    match: /tote|bag|swag|promo|souvenir/i,
    also: /soe|state|official|delegates|public/i,
    probes: [
      "These are token promotional items for delegates—what extra step applies to public officials?",
      "How do we track distribution?"
    ],
    expectPolicy: (msg) =>
      /(pre-?approval|approval)/i.test(msg) && /(compliance)/i.test(msg),
    positiveClose: "Yes. Token items for public officials need Compliance pre-approval and a simple distribution list."
  },
  {
    key: "business_class",
    match: /flight|travel|hotel|business class|business-class/i,
    probes: [
      "They proposed business-class to impress a prospect—what’s our travel standard?",
      "What else keeps the spend bona fide?"
    ],
    expectPolicy: (msg) =>
      /(economy)/i.test(msg) &&
      /(bona fide|agenda|company-?to-?company|records|record)/i.test(msg),
    positiveClose: "Correct. We stick to economy, ensure a bona fide business agenda, use company-to-company payments and keep accurate records."
  }
];

function clamp(text, n) {
  text = (text || "").toString();
  return text.length <= n ? text : text.slice(0, n);
}
function capSentences(s, max) {
  const parts = (s || "").replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]?/g) || [s || ""];
  return parts.slice(0, max).join(" ").trim();
}
function betty(s) { return clamp(capSentences(s, 2), 240); }

// ---- flow helpers ---------------------------------------------------------

// Find which scenario the current message most likely refers to
function detectScenario(msg) {
  const m = msg || "";
  for (const sc of SCENARIOS) {
    if (sc.match.test(m) && (!sc.also || sc.also.test(m))) return sc;
  }
  return null;
}

// How many probe/ask turns already happened in this scenario?
// We infer from the last ~12 lines of history.
function turnsSoFar(history, scKey) {
  if (!history) return 0;
  const lines = history.split(/\r?\n/).slice(-12);
  let count = 0;
  for (const line of lines) {
    // count only user lines that look like part of this thread
    if (/^You: /i.test(line)) count++;
    // stop counting if history mentions a different scenario keyword
    // (lightweight heuristic; good enough for short interviews)
  }
  return Math.max(0, Math.min(count, 6));
}

// Does the learner statement satisfy this scenario's policy?
function learnerStatedPolicy(sc, lastUserMsg) {
  try { return sc.expectPolicy(lastUserMsg || ""); }
  catch { return false; }
}

// Decide the next reply based on stage:
// stage 0–1: probe questions, stage 2: ask for policy, thereafter: evaluate and close/nudge.
function scenarioFlow(sc, message, history) {
  const t = turnsSoFar(history, sc.key);

  // If learner already stated policy, close positively
  if (learnerStatedPolicy(sc, message)) {
    return sc.positiveClose;
  }

  if (t <= 0) return sc.probes[0];              // first probe
  if (t === 1) return sc.probes[1] || "What risk do you see under policy?"; // second probe
  if (t === 2) return "What should I do according to policy?";              // ask for policy

  // Past three exchanges and still no policy: gentle steer
  return "Nearly there—what does our policy say to do in this case?";
}

// Fallback generic guidance if no scenario matched
function genericAnswer(msg) {
  const m = (msg || "").toLowerCase();
  if (/facilitation/.test(m)) return "Facilitation payments are banned; only in a safety emergency would we pay the minimum and report within 24 hours.";
  if (/public official|mayor|council/.test(m)) return "With public officials we keep to token items only (≤ £25) with Compliance pre-approval and a record in the Register.";
  return "I follow zero-tolerance rules, keep gifts modest and logged, avoid anything during tenders, and ask Compliance if in doubt.";
}

// ---------------------------------------------------------------------------

module.exports = function handler(req, res) {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, reply: "Betty is live. Use POST with {message, history}." });
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
      return res.status(200).json({ ok: true, reply: betty("Hi, I’m Betty from Acme. Ask me about gifts, hospitality or ABC.") });
    }

    const sc = detectScenario(message);
    if (sc) {
      const reply = scenarioFlow(sc, message, history);
      return res.status(200).json({ ok: true, reply: betty(reply) });
    }

    // No scenario hit: give generic ABC guidance, still concise
    return res.status(200).json({ ok: true, reply: betty(genericAnswer(message)) });

  } catch (e) {
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
