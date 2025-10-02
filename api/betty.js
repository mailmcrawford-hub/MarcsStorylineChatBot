// /api/betty — Betty persona + ABC scenarios (CommonJS, safe on Vercel)

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

const LIMITS = { gift: 50, giftPublicOfficial: 25, hospitality: 200 };

const GLOSSARY = {
  "bribe": "anything of value offered or received to improperly influence a decision",
  "anything of value": "cash, gifts, hospitality, travel, donations, jobs, internships, favours, discounts, confidential information",
  "facilitation payment": "small unofficial payment to speed routine actions — prohibited",
  "kickback": "secret payment or benefit for awarding business — prohibited",
  "public official": "anyone employed by or acting on behalf of a public body",
  "third party intermediary": "agent, distributor, reseller or consultant acting for Acme",
  "conflict of interest": "personal interest that could influence work decisions",
  "gifts and hospitality register": "record of gifts or hospitality provided or received",
  "due diligence": "risk-based checks on third parties before engagement",
  "speak up hotline": "confidential channel to report concerns"
};

const SCENARIOS = [
  { // Supplier offers £180 football tickets during a tender
    match: /ticket|match|football|game/i,
    also: /tender|rfp|bid/i,
    reply: "I’d decline because we’re in a tender and £180 looks excessive; we can meet for a simple coffee after the award and log it in the G&H Register."
  },
  { // Customs official asks for £20 to speed shipment
    match: /customs|border|shipment/i,
    also: /cash|speed|fast|quick/i,
    reply: "I’d refuse any ‘speed’ cash and ask for the official process; only if there’s a safety risk would I exit safely, pay the minimum and report within 24 hours."
  },
  { // Agent wants 15% to an offshore entity
    match: /agent|intermediary|consultant/i,
    also: /offshore|commission|percent|%/i,
    reply: "I’d pause and escalate to Compliance for due diligence and a transparent contract and invoices, otherwise we disengage."
  },
  { // Mayor asks for community fund
    match: /mayor|permit|council|official/i,
    also: /fund|donation|£|2,?000|2000/i,
    reply: "I’d decline the request from a public official and escalate; if we support the community, we do it via a compliant CSR route."
  },
  { // Client nudges hiring cousin
    match: /hire|cousin|relative|nephew|niece|family/i,
    also: /client|customer/i,
    reply: "I’d flag a conflict risk and route it through normal HR with no preferential treatment, documenting the decision."
  },
  { // Vendor sends a £30 hamper
    match: /hamper|gift|present|bottle|rioja|voucher|card/i,
    reply: "If it’s modest and not during a tender, I’d accept only within limits (≤ £50 per person), log it in the G&H Register and send a polite policy-aware thanks."
  },
  { // SOE delegates tote bags
    match: /tote|bag|swag|promo|souvenir/i,
    also: /soe|state|official|delegates|public/i,
    reply: "Token promotional items for public officials need Compliance pre-approval and a simple distribution list."
  },
  { // Business-class flights proposal
    match: /flight|travel|hotel|business class|business-class/i,
    reply: "We keep it to economy with a bona fide business agenda, company-to-company payment and accurate records."
  }
];

// ---------- helpers ----------
function clamp(text, n) {
  text = (text || "").toString();
  return text.length <= n ? text : text.slice(0, n);
}
function capSentences(s, max) {
  const parts = (s || "").replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]?/g) || [s || ""];
  return parts.slice(0, max).join(" ").trim();
}
function bettyVoice(s) {  // one–two short sentences, UK tone, B1
  let out = s || "Hi, I’m Betty from Acme. Ask me about gifts, hospitality or ABC.";
  out = capSentences(out, 2);
  return clamp(out, 240);
}
function scenarioAnswer(msg) {
  for (const s of SCENARIOS) {
    if (s.match.test(msg) && (!s.also || s.also.test(msg))) return s.reply;
  }
  return null;
}
function glossaryAnswer(msg) {
  const m = msg.toLowerCase();
  for (const k in GLOSSARY) { if (m.includes(k)) return `I mean ${k} as ${GLOSSARY[k]}.`; }
  return null;
}
function policyNudge(msg) {
  const t = msg.toLowerCase();
  const nums = []; const re = /£\s?(\d{1,4})/g; let m;
  while ((m = re.exec(msg))) nums.push(parseInt(m[1], 10));

  if (t.includes("tender") || t.includes("rfp")) return "I’d decline anything during a live tender and explain our policy.";
  if (t.includes("public official") || t.includes("mayor") || t.includes("council"))
    return "With public officials we stick to token items only (≤ £25) with Compliance pre-approval and a record in the Register.";
  if (nums.some(n => n > LIMITS.hospitality)) return `That looks lavish; we cap hospitality at ≤ £${LIMITS.hospitality} per person per event.`;
  if (nums.some(n => n > LIMITS.gift)) return `That’s over the gift limit; we keep single gifts ≤ £${LIMITS.gift} and log them.`;
  if (t.includes("cash") || t.includes("voucher")) return "Cash or cash-equivalent gifts are prohibited.";
  if (t.includes("facilitation")) return "Facilitation payments are banned; only in a safety emergency would we pay the minimum and report within 24 hours.";
  return null;
}

// ---------- handler ----------
module.exports = function handler(req, res) {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, reply: "Betty is live. Use POST with {message}." });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    let body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const message = (body.message || "").toString().trim();
    if (!message) {
      return res.status(200).json({ ok: true, reply: bettyVoice("Hi, I’m Betty from Acme. Ask me about gifts, hospitality or ABC.") });
    }

    const scen = scenarioAnswer(message);
    if (scen) return res.status(200).json({ ok: true, reply: bettyVoice(scen) });

    const gl = glossaryAnswer(message);
    if (gl) return res.status(200).json({ ok: true, reply: bettyVoice(gl) });

    const pol = policyNudge(message);
    if (pol) return res.status(200).json({ ok: true, reply: bettyVoice(pol) });

    const generic = "I follow zero-tolerance rules, keep gifts modest and logged, avoid anything during tenders and ask Compliance if in doubt.";
    return res.status(200).json({ ok: true, reply: bettyVoice(generic) });
  } catch (e) {
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
