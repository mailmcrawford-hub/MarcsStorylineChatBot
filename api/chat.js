// /api/chat — "Betty" scenario bot for Storyline (Node 18+)

const CONFIG = {
  character: {
    name: "Betty",
    role: "Sales Executive at Acme Group",
    tone: "friendly, candid, professional",
    locale: "UK English",
    reading_level: "B1"
  },
  interaction: {
    max_tokens_per_turn: 160,
    max_reply_chars: 240,
    max_sentences: 2
  },
  course: {
    summary:
      "Zero tolerance for bribery and facilitation payments; clear thresholds for gifts and hospitality; stricter rules for public officials; accurate records; third-party due diligence; safe reporting.",
    glossary: {
      bribe:
        "Anything of value offered or received to improperly influence a decision.",
      anything_of_value:
        "Cash, gifts, hospitality, travel, donations, jobs, internships, favours, discounts, confidential information.",
      facilitation_payment:
        "Small unofficial payment to speed routine actions—prohibited.",
      kickback:
        "Secret payment or benefit for awarding business—prohibited.",
      public_official:
        "Anyone employed by or acting on behalf of a public body.",
      third_party_intermediary:
        "Agent, distributor, reseller or consultant acting for Acme.",
      conflict_of_interest:
        "Personal interest that could influence work decisions.",
      gifts_and_hospitality_register:
        "Record of gifts or hospitality provided or received.",
      due_diligence:
        "Risk-based checks on third parties before engagement.",
      speak_up_hotline:
        "Confidential channel to report concerns."
    },
    policies: {
      gift_public_official_token_limit: 25,
      gift_non_official_limit: 50,
      gift_non_official_annual_cap: 150,
      hospitality_limit: 200
    },
    scenarios: [
      { key: "football_tickets_tender",
        match: /ticket|match|football|game/i,
        also: /tender|rfp|bid/i,
        reply: "I’d decline because we’re in a tender and £180 looks excessive; we can catch up for a simple coffee after the award and log anything in the G&H Register." },
      { key: "customs_speed_cash",
        match: /customs|border|shipment/i,
        also: /cash|speed|fast|quick/i,
        reply: "I’d refuse any ‘speed’ cash and ask for the official process; if there’s a genuine safety risk, I’d leave safely, pay only what’s unavoidable, and report within 24 hours." },
      { key: "agent_offshore_commission",
        match: /agent|intermediary|consultant/i,
        also: /offshore|commission|percent|%/i,
        reply: "I’d pause and escalate to Compliance for due diligence and a transparent contract and invoices, otherwise we disengage." },
      { key: "mayor_community_fund",
        match: /mayor|permit|council|official/i,
        also: /fund|donation|£|2,?000|2000/i,
        reply: "I’d decline the request from a public official and escalate; if we want to support the community, we’d consider a compliant CSR route instead." },
      { key: "client_cousin_hire",
        match: /hire|cousin|relative|nephew|niece|family/i,
        also: /client|customer/i,
        reply: "I’d flag a conflict risk and route it through normal HR with no preferential treatment, documenting the decision." },
      { key: "holiday_hamper",
        match: /hamper|gift|present|bottle|champagne|rioja|voucher|card/i,
        reply: "If it’s modest and not during a tender, I’d only accept within limits (≤ £50 per person), log it in the G&H Register, and send a polite policy-aware thank you." },
      { key: "soe_tote_bags",
        match: /tote|bag|swag|promo|souvenir/i,
        also: /soe|state|official|delegates|public/i,
        reply: "Token promotional items for public officials need Compliance pre-approval and a simple distribution list." },
      { key: "business_class_travel",
        match: /flight|travel|hotel|business class|business-class/i,
        reply: "We keep it to economy with a bona fide business agenda, company-to-company payment, and accurate records." }
    ]
  },
  safety: {
    out_of_scope_redirect: "Let’s keep this on ABC—here’s the relevant point.",
    refusal_message: "I can’t advise on that; here’s the ABC angle instead."
  }
};

// --- Helpers ---------------------------------------------------------------

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function clamp(text, n) {
  text = (text || "").toString();
  if (text.length <= n) return text;
  return text.slice(0, n);
}

function capSentences(s, maxSentences) {
  const parts = s
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/);
  return parts.slice(0, maxSentences).join(" ");
}

function smallDetail() {
  const bits = [
    "a small hamper",
    "a bottle of Rioja",
    "a £25 coffee card",
    "two matchday scarves",
    "a modest tote"
  ];
  return bits[Math.floor(Math.random() * bits.length)];
}

function glossaryAnswer(msg) {
  const m = msg.toLowerCase();
  let hitKey = null;
  Object.keys(CONFIG.course.glossary).some((k) => {
    if (m.includes(k.replace(/_/g, " "))) { hitKey = k; return true; }
    return false;
  });
  if (!hitKey) return null;

  const def = CONFIG.course.glossary[hitKey];
  return `I mean ${hitKey.replace(/_/g, " ")} as ${def}`;
}

function numbersIn(msg) {
  const re = /£\s?(\d{1,4})/g; const nums = [];
  let m;
  while ((m = re.exec(msg))) nums.push(parseInt(m[1], 10));
  return nums;
}

function policyNudges(msg) {
  const m = msg.toLowerCase();
  const nums = numbersIn(msg);
  const { gift_non_official_limit, hospitality_limit } = CONFIG.course.policies;

  if (m.includes("tender") || m.includes("rfp"))
    return "I’d decline anything during a live tender and explain our policy.";
  if (m.includes("public official") || m.includes("mayor") || m.includes("council"))
    return "With public officials we stick to token items only (≤ £25) with Compliance pre-approval and a record in the Register.";
  if (nums.some(n => n > hospitality_limit))
    return `That looks lavish; we cap hospitality at ≤ £${hospitality_limit} per person per event.`;
  if (nums.some(n => n > gift_non_official_limit))
    return `That’s over the gift limit; we keep single gifts ≤ £${gift_non_official_limit} and log them.`;
  if (m.includes("cash") || m.includes("voucher"))
    return "Cash or cash-equivalent gifts are prohibited.";
  if (m.includes("facilitation"))
    return "Facilitation payments are banned; only in a safety emergency would we pay the minimum and report within 24 hours.";
  return null;
}

function scenarioAnswer(msg) {
  const text = msg.toLowerCase();
  for (const s of CONFIG.course.scenarios) {
    const primary = s.match.test(text);
    const secondary = s.also ? s.also.test(text) : true;
    if (primary && secondary) return s.reply;
  }
  return null;
}

function inBettyVoice(s) {
  // Keep first-person, concise, UK English vibe; add a tiny realistic detail sometimes.
  let out = s;
  if (!/[.!?]$/.test(out)) out += ".";
  if (Math.random() < 0.35 && out.length < 200) {
    out += ` I once logged ${smallDetail()} after a demo.`;
  }
  out = capSentences(out, CONFIG.interaction.max_sentences);
  return clamp(out, CONFIG.interaction.max_reply_chars);
}

// --- HTTP handler ----------------------------------------------------------

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const message = (body.message || "").toString();
    const history = (body.history || "").toString(); // currently unused, but kept for future logic

    if (!message.trim()) {
      return res.status(200).json({ ok: true, reply: inBettyVoice("Hi, I’m Betty from Acme. Ask me about gifts, hospitality or ABC.") });
    }

    // 1) Glossary lookups
    const g = glossaryAnswer(message);
    if (g) return res.status(200).json({ ok: true, reply: inBettyVoice(g) });

    // 2) Scenario matches
    const scen = scenarioAnswer(message);
    if (scen) return res.status(200).json({ ok: true, reply: inBettyVoice(scen) });

    // 3) Policy nudges
    const pol = policyNudges(message);
    if (pol) return res.status(200).json({ ok: true, reply: inBettyVoice(pol) });

    // 4) Generic ABC guidance
    const generic =
      "I follow zero-tolerance rules, keep gifts modest and logged, avoid anything during tenders, and ask Compliance if in doubt.";
    return res.status(200).json({ ok: true, reply: inBettyVoice(generic) });

  } catch (err) {
    return res.status(200).json({ ok: false, reply: "", error: "Could not process your message." });
  }
}
