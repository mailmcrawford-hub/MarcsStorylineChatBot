// /api/betty — Betty persona: kind, polite, unaware of policy (CommonJS)

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

// ---- Persona ----------------------------------------------------------------
const BETTY = {
  name: "Betty",
  role: "Sales Executive at Acme Group",
  home: "Manchester",
  warmth: ["kind", "polite", "open", "helpful"],
  quirks: [
    "I keep a tiny paper diary with sticky notes",
    "I’m partial to a flat white before client calls"
  ],
  // Greeting for health-check (GET) and empty message
  opener: "Hi Detective, how can I help?",
  // Small-talk response example requested by you
  smallTalkReply: "Hi Detective, I’m good thank you. What can I do for you?"
};

// Keep replies natural, UK English, 1–3 short sentences, relaxed cap
const MAX_SENTENCES = 3;
const MAX_CHARS = 360;

function clamp(t, n){ t = (t||"").toString(); return t.length <= n ? t : t.slice(0, n); }
function toSentences(s){ return (s||"").replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]?/g) || []; }
function capSentences(s, max){ return toSentences(s).slice(0, max).join(" ").trim(); }
function tone(s){
  let out = s || BETTY.opener;
  if (Math.random() < 0.2 && out.length < 280) {
    const q = BETTY.quirks[Math.floor(Math.random()*BETTY.quirks.length)];
    out += ` ${q}.`;
  }
  return clamp(capSentences(out, MAX_SENTENCES), MAX_CHARS);
}

// ---- Scenario prompts (Betty speaks innocently, asks for guidance) ----------
const SCENARIOS = [
  {
    key: "tickets_tender",
    match: /ticket|match|football|game/i, also: /tender|rfp|bid/i,
    say: () => "A supplier offered me football tickets worth about £180 while we’re in a bid. It felt generous. Would you like me to accept or park it until later?"
  },
  {
    key: "customs_speed_cash",
    match: /customs|border|shipment/i, also: /cash|speed|fast|quick/i,
    say: () => "At customs someone hinted £20 would speed our shipment. I wasn’t sure what to do. How would you like me to handle that?"
  },
  {
    key: "agent_offshore",
    match: /agent|intermediary|consultant/i, also: /offshore|commission|percent|%/i,
    say: () => "An agent asked for 15% paid to an offshore account. Does that sound normal to you, or should I pause it?"
  },
  {
    key: "mayor_fund",
    match: /mayor|permit|council|official/i, also: /fund|donation|£|2,?000|2000/i,
    say: () => "The mayor’s office mentioned a £2,000 ‘community fund’ before our permit renewal. It felt a bit odd. What would you like me to say?"
  },
  {
    key: "client_cousin_hire",
    match: /hire|cousin|relative|nephew|niece|family/i, also: /client|customer/i,
    say: () => "A client asked if we could hire their cousin for a role. I can pass on the CV. Is that alright with you?"
  },
  {
    key: "hamper_30",
    match: /hamper|gift|present|bottle|rioja|voucher|card/i,
    say: () => "A vendor sent a little hamper, about £30, and there’s no tender on. Shall I keep it and send a thank you, or return it?"
  },
  {
    key: "soe_tote",
    match: /tote|bag|swag|promo|souvenir/i, also: /soe|state|official|delegates|public/i,
    say: () => "We’ve got simple conference totes for visitors from a state-owned firm. Is it fine to hand them out, and do you want anything noted?"
  },
  {
    key: "business_class",
    match: /flight|travel|hotel|business class|business-class/i,
    say: () => "The team suggested business-class for a prospect visit to make a good impression. Would you approve that, or keep it simpler?"
  }
];

function detectScenario(msg){
  for (const sc of SCENARIOS){
    if (sc.match.test(msg) && (!sc.also || sc.also.test(msg))) return sc;
  }
  return null;
}

// ---- Free chat (no policy pushing; just honest, helpful answers) -----------
function isSmallTalk(msg){
  return /(hello|hi|hey|morning|afternoon|evening|how are you|how’s it going|how are u)/i.test(msg);
}
function friendlyChat(msg){
  const m = msg.toLowerCase();
  if (/travel|flight|hotel|expenses/.test(m))
    return "I travel now and then for demos and try to keep plans simple and tidy. Do you want me to keep anything in particular for records?";
  if (/client|prospect|meeting|demo/.test(m))
    return "With clients I like a clear agenda and a friendly tone so we get to the real questions. What are you looking into today?";
  if (/register|record|log|books/.test(m))
    return "I’m happy to note things down if you want a record. Tell me what you’d like captured.";
  if (/agent|intermediary|third party|due diligence/.test(m))
    return "With agents I prefer plain contracts and straightforward invoices. Would you like me to gather anything from them?";
  if (/donation|sponsorship|charity|csr/.test(m))
    return "I can ask about charitable bits if you want, and keep it transparent. How would you like me to phrase it?";
  if (/conflict|relative|cousin|friend/.test(m))
    return "If there’s a personal link I’ll mention it openly so everyone’s comfortable. What’s your call on the next step?";
  if (/coffee|lunch|dinner|tickets|event/.test(m))
    return "I’m fine with simple meet-ups or low-key events if you are. What would you prefer I arrange?";
  // Default, warm reflection without policy
  const snippet = (msg || "").replace(/\s+/g," ").trim().slice(0,140);
  return snippet ? `Thanks. I hear you on “${snippet}”. How would you like me to proceed?`
                 : "I’m listening. What would you like me to do?";
}

// ---- Handler ---------------------------------------------------------------
module.exports = function handler(req, res){
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET"){
    return res.status(200).json({ ok: true, reply: BETTY.opener });
  }
  if (req.method !== "POST"){
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    let body = req.body || {};
    if (typeof body === "string"){ try { body = JSON.parse(body); } catch { body = {}; } }

    const message = (body.message || "").toString().trim();
    // history is sent but not used for logic now (we’re keeping it simple and free-flow)
    // const history = (body.history || "").toString();

    if (!message){
      return res.status(200).json({ ok: true, reply: tone(BETTY.opener) });
    }

    // Small talk first
    if (isSmallTalk(message)){
      return res.status(200).json({ ok: true, reply: tone(BETTY.smallTalkReply) });
    }

    // Scenario phrasing from Betty’s perspective (no policy statements)
    const sc = detectScenario(message);
    if (sc){
      return res.status(200).json({ ok: true, reply: tone(sc.say(message)) });
    }

    // Friendly, topic-relevant chat (no guardrail nudge to policy)
    return res.status(200).json({ ok: true, reply: tone(friendlyChat(message)) });

  } catch (e){
    return res.status(200).json({ ok: false, reply: "", error: "Server error processing your message." });
  }
};
