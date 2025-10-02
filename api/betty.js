// /api/betty — Betty persona + ABC scenarios + probes + light free-flow (CommonJS)

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}
const LIMITS = { gift: 50, giftPublicOfficial: 25, hospitality: 200 };

// --- Betty's persona (used for small-talk and tone) ------------------------
const BETTY = {
  name: "Betty",
  role: "Sales Executive at Acme Group",
  vibe: ["friendly", "candid", "professional"],
  home: "Manchester",
  quirks: [
    "I keep a tiny paper diary with sticky notes",
    "I’m partial to a flat white before client calls",
    "I once logged a small hamper after a demo, just to be safe"
  ],
  opener: "Hi, I’m Betty from Acme. Ask me about gifts, hospitality or ABC."
};

// --- Scenarios with probes and success conditions -------------------------
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

// --- Utility helpers -------------------------------------------------------
function clamp(text, n) { text = (text || "").toString(); return text.length <= n ? text : text.slice(0, n); }
function capSentences(s, max) { const parts = (s||"").replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]?/g)||[s||""]; return parts.slice(0,max).join(" ").trim(); }
function bettyTone(s) {
  // Keep 1–2 short sentences, UK tone; sprinkle a tiny detail sometimes.
  let out = s || BETTY.opener;
  if (Math.random() < 0.25 && out.length < 180) {
    const q = BETTY.quirks[Math.floor(Math.random()*BETTY.quirks.length)];
    out += `. ${q}.`;
  }
  return clamp(capSentences(out, 2), 240);
}

// --- Free-flow: small talk & loosely related Qs ----------------------------
function isSmallTalk(msg) {
  const m = msg.toLowerCase();
  return /(how are you|who are you|where.*from|your role|what do you do|hello|hi|morning|afternoon)/i.test(m);
}
function smallTalkReply() {
  return `${BETTY.name} here in ${BETTY.home}; I’m a sales exec at Acme. Happy to chat, but let’s keep it around gifts, hospitality and ABC.`;
}
function isLooselyRelated(msg) {
  // Allow short answers on sales life, clients, targets, demos, travel, meetings, ethics, training
  return /(client|prospect|demo|quarter|target|travel|meeting|training|ethic|policy|register|record|due diligence)/i.test(msg);
}
function looseReply(msg) {
  // Brief answer + steer back
  if (/travel/i.test(msg)) return "I travel a fair bit for demos; I keep receipts tidy and stick to economy. What ABC point are you exploring?";
  if (/client|prospect/i.test(msg)) return "Clients like a clear agenda and outcomes. Where does ABC guidance fit in your case?";
  if (/register|record/i.test(msg)) return "I log items of value in the G&H Register so books stay accurate. What does policy say for your scenario?";
  return "Happy to share from experience; I try to keep things tidy and transparent. What’s the ABC angle you want me to apply?";
}

// --- Scenario & policy flow -----------------------------------------------
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

// --- Generic fallback ------------------------------------------------------
function genericAnswer(msg) {
  const m = (msg || "").toLowerCase();
  if (/facilitation/.test(m)) return "Facilitation payments are banned; only in a safety emergency would we pay the minimum and report within 24 hours.";
  if (/public official|mayor|council/.test(m)) return "With public officials we keep to token items only (≤ £25) with Compliance pre-approval and a record in the Register.";
  return "I follow zero-tolerance rules, keep gifts modest and logged, avoid anything during tenders, and ask Compliance if in doubt.";
}

// --- HTTP handler ----------------------------------------------------------
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

    // 1) Small talk gets a warm, short reply, then steer back
    if (isSmallTalk(message)) {
      return res.status(200).json({ ok: true, reply: bettyTone(smallTalkReply()) });
    }

    // 2) Loosely related work questions allowed, then nudge toward ABC
    if (isLooselyRelated(message)) {
      return res.status(200).json({ ok: true, reply: bettyTone(looseReply(message)) });
    }

    // 3) Scenario flow with probes and positive close on correct policy
    const sc = detectScenario(message);
    if (sc) {
      const reply = scenarioFlow(sc, message, history);
      return res.status(200).json({ ok: true, reply: bettyTone(reply) });
    }

    // 4) Generic ABC guidance
    return res.status(200).json({ ok: true, reply: bettyTone(genericAnswer(message)) });

  } catch (e) {
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
