// /api/betty — Betty persona + probes + conversational fallback (CommonJS)

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
  opener: "Hi, I’m Betty from Acme. Ask me about gifts, hospitality or ABC."
};

const SCENARIOS = [
  {
    key: "tickets_tender",
    match: /ticket|match|football|game/i,
    also: /tender|rfp|bid/i,
    probes: [
      "It’s during a live tender and about £180—what risk do you see?",
      "If I wanted to keep the relationship warm, what compliant alternative could I suggest?"
    ],
    expectPolicy: (msg) => /decline|refus(e|al)|do not accept/i.test(msg) && /(tender|rfp|bid)/i.test(msg),
    positiveClose: "Agreed. We decline anything during tenders; a simple coffee after the award is fine, and we log it in the G&H Register."
  },
  {
    key: "customs_speed_cash",
    match: /customs|border|shipment/i,
    also: /cash|speed|fast|quick/i,
    probes: [
      "They asked for £20 to ‘speed it up’—what does policy call that?",
      "If there’s no safety risk, what should I do instead?"
    ],
    expectPolicy: (msg) => /(facilitation|unofficial)/i.test(msg) && /(refuse|decline|do not pay)/i.test(msg),
    positiveClose: "Right. It’s a facilitation payment—we refuse and ask for the official process; only pay the minimum if there’s a true safety risk and report within 24 hours."
  },
  {
    key: "agent_offshore",
    match: /agent|intermediary|consultant/i,
    also: /offshore|commission|percent|%/i,
    probes: [
      "They want 15% to an offshore entity—what’s our first step?",
      "What paperwork would make it transparent?"
    ],
    expectPolicy: (msg) => /(pause|hold|stop)/i.test(msg) && /(escalate|compliance|due diligence)/i.test(msg),
    positiveClose: "Yes. We pause and escalate to Compliance for due diligence and a transparent contract with proper invoices, or we disengage."
  },
  {
    key: "mayor_fund",
    match: /mayor|permit|council|official/i,
    also: /fund|donation|£|2,?000|2000/i,
    probes: [
      "It’s tied to a permit by a public official—what’s the issue?",
      "If we want to help the community, what compliant route works?"
    ],
    expectPolicy: (msg) => /(decline|refuse)/i.test(msg) && /(public official|official)/i.test(msg),
    positiveClose: "Correct. We decline and escalate; a compliant CSR route is the alternative."
  },
  {
    key: "client_cousin_hire",
    match: /hire|cousin|relative|nephew|niece|family/i,
    also: /client|customer/i,
    probes: [
      "They’re nudging to hire a cousin—what risk is that?",
      "How do we keep the decision clean?"
    ],
    expectPolicy: (msg) => /(conflict)/i.test(msg) && /(standard|normal)\s*hr|hr process|no preferential/i.test(msg),
    positiveClose: "Exactly. It’s a conflict risk—use the standard HR process with no preferential treatment and document the decision."
  },
  {
    key: "hamper_30",
    match: /hamper|gift|present|bottle|rioja|voucher|card/i,
    probes: [
      "It’s about £30 and no live tender—what limits apply?",
      "If I accept, what admin step follows?"
    ],
    expectPolicy: (msg) => /(accept|okay|fine)/i.test(msg) && /(limit|£?50|fifty)/i.test(msg) && /(register|log|g(&|and)h)/i.test(msg),
    positiveClose: "Spot on. Acceptable within limits (≤ £50), not during tenders, and we log it in the G&H Register with a polite policy-aware thanks."
  },
  {
    key: "soe_tote",
    match: /tote|bag|swag|promo|souvenir/i,
    also: /soe|state|official|delegates|public/i,
    probes: [
      "Token items for delegates—what extra step applies to public officials?",
      "How do we track distribution?"
    ],
    expectPolicy: (msg) => /(pre-?approval|approval)/i.test(msg) && /(compliance)/i.test(msg),
    positiveClose: "Yes. Token items for public officials need Compliance pre-approval and a simple distribution list."
  },
  {
    key: "business_class",
    match: /flight|travel|hotel|business class|business-class/i,
    probes: [
      "They proposed business-class to impress a prospect—what’s our travel standard?",
      "What else keeps the spend bona fide?"
    ],
    expectPolicy: (msg) => /(economy)/i.test(msg) && /(bona fide|agenda|company-?to-?company|records|record)/i.test(msg),
    positiveClose: "Correct. We stick to economy, ensure a bona fide agenda, use company-to-company payments, and keep accurate records."
  }
];

// ---------- utilities ----------
function clamp(text, n) { text = (text || "").toString(); return text.length <= n ? text : text.slice(0, n); }
function capSentences(s, max) { const parts = (s||"").replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]?/g)||[s||""]; return parts.slice(0,max).join(" ").trim(); }
function bettyTone(s) {
  let out = s || BETTY.opener;
  if (Math.random() < 0.25 && out.length < 180) {
    const q = BETTY.quirks[Math.floor(Math.random()*BETTY.quirks.length)];
    out += `. ${q}.`;
  }
  return clamp(capSentences(out, 2), 240);
}

function detectScenario(msg) {
  for (const sc of SCENARIOS) {
    if (sc.match.test(msg) && (!sc.also || sc.also.test(msg))) return sc;
  }
  return null;
}
function turnsSoFar(history) {
  if (!history) return 0;
  return Math.max(0, Math.min(history.split(/\r?\n/).filter(l => /^You:\s/i.test(l)).length, 6));
}
function scenarioFlow(sc, userMsg, history) {
  const t = turnsSoFar(history);
  if (sc.expectPolicy(userMsg)) return sc.positiveClose;
  if (t <= 0) return sc.probes[0];
  if (t === 1) return sc.probes[1] || "What risk do you see under policy?";
  if (t === 2) return "What should I do according to policy?";
  return "Nearly there—what does our policy say to do in this case?";
}

// ---------- conversational fallback (replaces bland generic line) ----------
function topicCategory(msg) {
  const m = msg.toLowerCase();
  if (/voucher|cash|gift card|crypto/.test(m)) return "cash_like";
  if (/gift|hamper|present|bottle|rioja/.test(m)) return "gift";
  if (/hospitality|dinner|lunch|tickets|event/.test(m)) return "hospitality";
  if (/public official|mayor|council|soe|state/.test(m)) return "public_official";
  if (/tender|rfp|bid/.test(m)) return "tender";
  if (/register|log|record|books/.test(m)) return "records";
  if (/due diligence|onboard|third party|agent|intermediary/.test(m)) return "third_party";
  if (/travel|flight|hotel|expenses/.test(m)) return "travel";
  if (/donation|sponsorship|charity|csr/.test(m)) return "donations";
  if (/conflict|relative|cousin|friend/.test(m)) return "conflict";
  return "misc";
}

function summarise(msg) {
  const words = (msg || "").toLowerCase().replace(/[^a-z0-9£\s]/g,"").split(/\s+/).filter(w => w && w.length > 2);
  const keep = [];
  for (const w of words) {
    if (keep.indexOf(w) === -1 && keep.length < 5) keep.push(w);
  }
  return keep.join(" ");
}

function conversationalReply(msg) {
  const cat = topicCategory(msg);
  switch (cat) {
    case "cash_like":
      return "Cash or cash-equivalent gifts are off limits; I steer to a modest, transparent option or decline. What policy bit would you apply here?";
    case "gift":
      return `Small gifts can be okay if not influencing anything and ≤ £${LIMITS.gift}; we log them. What would you have me do in your case?`;
    case "hospitality":
      return `Hospitality must be reasonable and ≤ £${LIMITS.hospitality} per person; not during live tenders. What’s the compliant next step?`;
    case "public_official":
      return "With public officials we keep to token items only (≤ £25) with Compliance pre-approval. How would you guide me here?";
    case "tender":
      return "During tenders we avoid gifts or hospitality altogether to remove doubt. What would you advise me to do?";
    case "records":
      return "I keep the G&H Register tidy so our books are accurate. What should I record in your scenario?";
    case "third_party":
      return "With agents we do risk-based due diligence and clear contracts. What safeguard would you want first?";
    case "travel":
      return "I stick to economy and keep receipts neat; it keeps spend bona fide. What policy point matters most here?";
    case "donations":
      return "Donations need Compliance pre-approval and go to organisations, not people. What would you recommend I do?";
    case "conflict":
      return "Where there’s a personal link, I call out the conflict and route via the standard process. What’s your direction for me?";
    default: {
      const hint = summarise(msg);
      return hint
        ? `I hear you on "${hint}". From a practical view I keep things modest, logged and transparent. What does policy say I should do?`
        : "Happy to chat from experience. What does policy say I should do here?";
    }
  }
}

// ---------- HTTP handler ----------
module.exports = function handler(req, res) {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, reply: `${BETTY.opener}` });
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

    // 1) Scenario flow (with probes and positive close when learner states policy)
    const sc = detectScenario(message);
    if (sc) {
      const reply = scenarioFlow(sc, message, history);
      return res.status(200).json({ ok: true, reply: bettyTone(reply) });
    }

    // 2) Conversational fallback (reflect + brief answer + nudge)
    const talk = conversationalReply(message);
    return res.status(200).json({ ok: true, reply: bettyTone(talk) });

  } catch (e) {
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
