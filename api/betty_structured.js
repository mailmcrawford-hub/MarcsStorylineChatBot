// /api/betty_structured.js
// Structured, scenario-aware interview bot for Storyline (Betty or Freda).
// Returns JSON: { ok:true, json:{ reply_text, tone_detected, stance, policy_points_referenced[], risk_flags[], next_questions_for_detective[], memory_updates[], suggested_stage_transition } }

function setCORS(res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Accept");
}

// Optional: authored Q&A and phrasing banks (qaPairs lives here)
let BANK = null;
try { BANK = require("./betty_banks"); } catch { BANK = { qaPairs: [], greetings: [], persona:{ openers:["Hi Detective, how can I help?"] } }; }

const PERSONAE = {
  Betty: { name: "Betty Morales", role: "Sales Executive at Acme Things Ltd." },
  Freda: { name: "Freda Morales", role: "Sales Executive at Acme Things Ltd." }
};

// Grounding facts (scenario)
const FACTS = {
  gift: "luxury food and wine hamper",
  sender: "ClientCo (arranged by Raj)",
  delivery: "courier to Acme office",
  timing: "two weeks before a renewal decision meeting",
  valueRange: [150,220],
  card: "locking in the renewal",
  disclosureFiled: false,
  mentionedInChat: true
};

// Policy gist
const POLICY = {
  giftApprovalThreshold: 25,
  requireDisclosureOver: 25,
  giftsLinkedToDecisionProhibited: true,
  actions: ["disclosure", "return", "donate", "manager notification"]
};

/* ---------------- helpers ---------------- */
const MAX_FIELD_CHARS = 600;
const clamp = s => (s||"").toString().slice(0, MAX_FIELD_CHARS);
const norm  = s => (s||"").toLowerCase();

function toneDetect(msg){
  const m = norm(msg);
  if (/(asap|quick|hurry|now|urgent)/.test(m)) return "rushed";
  if (/(policy|section|per|threshold|disclosure form|compliance)/.test(m)) return "legalistic";
  if (/(why did you|you should|you realise|breach|violate|against|wrong)/.test(m)) return "accusatory";
  if (/(can you walk me|talk me through|help me understand|could you explain|what happened)/.test(m) || (m.match(/\?/g)||[]).length>=2) return "probing";
  if (/(thanks|thank you|appreciate|that helps|no worries|we’ll sort this)/.test(m)) return "supportive";
  return "neutral";
}
function stanceFromTone(t, history){
  if (t==="accusatory") return "defensive";
  if (/disclosure|over\s*25|return|donate|manager/i.test(history||"")) return "cooperative";
  if (t==="probing"||t==="neutral") return "curious";
  if (t==="legalistic") return "minimizing";
  return "cooperative";
}
function risksFromContext(message){
  const risks = [];
  risks.push("high_value_gift(£150–£220)");
  risks.push("near_decision_timing(2_weeks_pre_renewal)");
  risks.push("explicit_intent_card('locking in the renewal')");
  risks.push("no_disclosure_filed");
  const m = norm(message);
  if (/(influence|lock in|win.*renewal|secure.*deal)/.test(m)) risks.push("appearance_of_influence");
  if (/(keep|accept|take)/.test(m) && /(gift|hamper|wine)/.test(m)) risks.push("acceptance_without_approval");
  return risks;
}
function policyPoints(msg){
  const pts = [];
  const m = norm(msg);
  if (/(25|£25|twenty[- ]?five)/.test(m)) pts.push("gifts_over_25_require_pre-approval_disclosure");
  if (/(renewal|decision|approval meeting|tender|rfp|bid)/.test(m)) pts.push("gifts_tied_to_decisions_prohibited");
  if (/(disclose|disclosure|form)/.test(m)) pts.push("use_disclosure_form");
  if (/(return|donate)/.test(m)) pts.push("return_or_donate_when_in_doubt");
  if (/(notify|tell|manager)/.test(m)) pts.push("notify_manager");
  return pts;
}
function mentions(msg, re){ return re.test(norm(msg)); }

// GREETING detector (prevents scene recap on “Hi”)
function isGreeting(msg){
  const m = (msg||"").toLowerCase().trim();
  return /^(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening))\b/.test(m) ||
         /^(thanks|thank you)$/.test(m);
}

/* ---------- token utils for QA matching ---------- */
const stopwords = new Set("the a an and or but if then so to of for on in at by from with as is are was were be been being do does did have has had you your we our us it this that those these there here what when where why how can may should could would will".split(" "));
function cleanForTokens(s){ return (s||"").toLowerCase().replace(/[^a-z0-9£ ]+/g," ").replace(/\s+/g," ").trim(); }
function tokens(s){ return new Set(cleanForTokens(s).split(" ").filter(Boolean).filter(w=>!stopwords.has(w))); }
function jaccard(a,b){ if(!a.size||!b.size) return 0; let inter=0; for(const t of a){ if(b.has(t)) inter++; } return inter/(a.size+b.size-inter); }

/* ---------- slot extraction for QA boost & rules ---------- */
function getAmount(text){
  const msg = text || "";
  const m1 = msg.match(/£\s?(\d{1,5})(?:\.\d{1,2})?/i);
  if (m1) return Math.round(parseFloat(m1[1]));
  const m2 = msg.match(/\b(\d{1,5})\s*(?:quid|pounds|gbp)\b/i);
  if (m2) return parseInt(m2[1],10);
  const m3 = msg.match(/\b(?:about|around|roughly)\s*£?\s?(\d{1,5})\b/i);
  return m3 ? parseInt(m3[1],10) : null;
}
const isDuringTender   = (m) => /(tender|rfp|bid|decision meeting|renewal)/i.test(norm(m||""));
const mentionsOfficial = (m) => /(public\s*official|mayor|council|mp|soe|state[-\s]*owned)/i.test(norm(m||""));

/* ---------- QA matcher (uses your BANK.qaPairs if present) ---------- */
function qaBestMatch(message){
  const pairs = (BANK && Array.isArray(BANK.qaPairs)) ? BANK.qaPairs : [];
  if (!pairs.length) return null;

  const qset = tokens(message);
  let best = null, bestScore = 0;

  for (const pair of pairs){
    if (!pair || !pair.q || !pair.a) continue;
    const tset = tokens(pair.q);
    let score = jaccard(qset, tset);

    // slot-aware boosts
    const amtQ = getAmount(message), amtT = getAmount(pair.q);
    if (amtQ && amtT && Math.abs(amtQ - amtT) <= 5) score += 0.2;
    if (isDuringTender(message) && isDuringTender(pair.q)) score += 0.2;
    if (mentionsOfficial(message) && mentionsOfficial(pair.q)) score += 0.2;

    if (score > bestScore){ bestScore = score; best = pair; }
  }

  const confident = best && bestScore >= 0.55;
  const shortQ    = cleanForTokens(message).split(" ").length <= 9 && bestScore >= 0.40;
  return (confident || shortQ) ? best : null;
}

/* ---------- Specific scenario snippets (before general Q&A) ---------- */
const SCENARIOS = [
  { id:"tickets_tender",
    match:/ticket|match|football|game/i, also:/tender|rfp|bid/i,
    variants:[ "During tenders we avoid gifts and hospitality—even match tickets. We can meet after the award." ]
  },
  { id:"customs_speed_cash",
    match:/customs|border|shipment/i, also:/cash|speed|fast|quick/i,
    variants:[ "That sounds like a facilitation payment—I’d refuse and ask for the official process, then report it." ]
  },
  { id:"agent_offshore",
    match:/agent|intermediary|consultant/i, also:/offshore|commission|percent|%/i,
    variants:[ "Let’s pause and gather proper paperwork; offshore commissions need review before we proceed." ]
  }
];
function detectScenario(message){
  for (const sc of SCENARIOS){
    if (sc.match.test(message) && (!sc.also || sc.also.test(message))) return sc;
  }
  return null;
}

/* =======================================================================
   ANSWER-FIRST replyEngine (with greeting handler)
   ======================================================================= */
function replyEngine({persona, message, history}) {
  const who = persona==="Freda" ? PERSONAE.Freda : PERSONAE.Betty;

  // 0) Tone & stance
  const tone = toneDetect(message);
  let stance = stanceFromTone(tone, history);

  // GREETING → friendly open, no scenario recap
  if (isGreeting(message)) {
    const first = who.name.split(" ")[0];
    const reply = `Hi Detective, ${first} here. What would you like to know about the hamper?`;
    return {
      persona: who.name,
      reply_text: clamp(reply),
      tone_detected: tone,
      stance,
      policy_points_referenced: [],
      risk_flags: [],
      next_questions_for_detective: [],
      memory_updates: [],
      suggested_stage_transition: "stay"
    };
  }

  // Shared containers
  const m = norm(message);
  const ppSet   = new Set();
  const flags   = new Set(risksFromContext(message));
  const nextQs  = [];   // at most one
  const memory  = [];
  let stage     = "stay";

  const addPP = (...x)=>x.forEach(v=>ppSet.add(v));
  const addF  = (...x)=>x.forEach(v=>flags.add(v));

  const amt           = getAmount(message);
  const duringTender  = isDuringTender(message);
  const publicOfficial= mentionsOfficial(message);
  const isQuestion    = /\?\s*$/.test(message) || /^(what|why|how|who|where|when|can|may|should|could|do|does|did|is|are|am)\b/i.test(m);

  // If the learner just explained policy → cooperate
  if (/(over\s*25|£\s*25).*(disclosure|form)|gifts.*(decision|renewal).*prohibit|when in doubt.*(disclose|return|donate)/i.test(m)) {
    stance = "cooperative";
  }

  // 1) Specific scenarios
  const sc = detectScenario(message);
  if (sc){
    const reply = clamp(sc.variants[0]);
    return pack(reply, "advance");
  }

  // 2) Authored QA pairs (highest precision, answer-first)
  const qa = qaBestMatch(message);
  if (qa){
    if (/disclos/.test(qa.a)) addPP("use_disclosure_form");
    if (/return|donate/.test(qa.a)) addPP("return_or_donate_when_in_doubt");
    if (/(tender|rfp|bid|decision)/i.test(qa.a)) addPP("gifts_tied_to_decisions_prohibited");
    return pack(clamp(qa.a), "stay");
  }

  // 3) Slot-aware direct answers by question type (always answer first)

  // Facts / what happened
  if (/(what.*happened|tell.*about|how.*came|who sent|when.*delivered)/i.test(m)) {
    const reply = `It arrived by courier to reception about two weeks before the renewal meeting. ClientCo sent it—Raj arranged it. The card mentioned “locking in the renewal”.`;
    memory.push("facts_confirmed:delivery/sender/timing/card");
    return pack(reply, "advance");
  }

  // Value
  if (/(how much|value|worth|price|estimate)/i.test(m)) {
    const reply = `It looked like a high-end hamper, roughly £150–£220 with the wine.`;
    memory.push("facts_confirmed:approx_value_150-220");
    addF("high_value_gift(£150–£220)");
    if (isQuestion && !/disclos|form/.test(m)) nextQs.push("Do you want me to file the disclosure now?");
    addPP("use_disclosure_form");
    return pack(reply, "advance");
  }

  // Disclosure / logging
  if (/(did you disclose|disclosure|form|register|log)/i.test(m)) {
    const reply = `I haven’t filed the disclosure yet—I only mentioned it in team chat. I can complete the form now.`;
    memory.push("facts_confirmed:no_disclosure_filed");
    addPP("use_disclosure_form");
    return pack(reply, "advance");
  }

  // Keep / accept / what to do
  if (/(keep|accept|take|hold onto)/i.test(m) && /(gift|hamper|wine)/i.test(m)) {
    if (publicOfficial) {
      const reply = `Because it involves a public official, only token items are okay. I’ll disclose and return or donate it, and notify my manager.`;
      addPP("use_disclosure_form","return_or_donate_when_in_doubt","notify_manager");
      return pack(reply, "escalate_to_policy_coaching");
    }
    if (duringTender || /(renewal|decision)/i.test(m) || (amt && amt>POLICY.giftApprovalThreshold)) {
      const reply = `Given the value and the renewal timing, I shouldn’t keep it. I’ll submit the disclosure and arrange to return or donate it, and notify my manager.`;
      addPP("gifts_tied_to_decisions_prohibited","use_disclosure_form","return_or_donate_when_in_doubt","notify_manager");
      return pack(reply, "escalate_to_policy_coaching");
    }
    const reply = `If it isn’t approved in advance, I should disclose and return or donate it. I’ll loop in my manager.`;
    addPP("use_disclosure_form","return_or_donate_when_in_doubt","notify_manager");
    return pack(reply, "advance");
  }

  // Why different from dinners?
  if (/(why|how).*different.*(dinner|meal|hospitality)/i.test(m)) {
    const reply = `Dinners can be pre-approved as hospitality, but the hamper is a gift tied to a decision and wasn’t disclosed. That’s why it’s riskier.`;
    addPP("gifts_tied_to_decisions_prohibited","use_disclosure_form");
    return pack(reply, "advance");
  }

  // Next steps
  if (/(next step|what now|what should you do|what do i do|plan)/i.test(m)) {
    const reply = `I’ll file the disclosure today, then donate the hamper to avoid any appearance of influence. I’ll also notify my manager.`;
    addPP("use_disclosure_form","return_or_donate_when_in_doubt","notify_manager");
    return pack(reply, "close_and_commit");
  }

  // Generic fallback (still anchored to the scene)
  {
    const reply = `It was a ClientCo hamper delivered to reception, about £150–£220, two weeks before the renewal meeting. The card said “locking in the renewal”.`;
    if (isQuestion && !/(value|worth|disclos|form)/i.test(m)) nextQs.push("Do you want the disclosure raised now and the hamper donated?");
    return pack(reply, "stay");
  }

  // package & post-process
  function pack(text, nextStage){
    let out = clamp(text);

    // If tone accusatory, allow a brief defensive note, but still comply
    if (tone==="accusatory" && stance!=="cooperative"){
      out += " I didn’t ask for it, but I understand the concern.";
      stance = "defensive";
    }

    // auto-add PP based on reply content
    if (/disclos/.test(out)) addPP("use_disclosure_form");
    if (/return|donate/.test(out)) addPP("return_or_donate_when_in_doubt");
    if (/manager/.test(out)) addPP("notify_manager");

    // de-dupe & enforce field limits
    const dedupe = arr => Array.from(new Set(arr)).map(clamp);

    return {
      persona: who.name,
      reply_text: clamp(out),
      tone_detected: tone,
      stance,
      policy_points_referenced: dedupe(Array.from(ppSet)),
      risk_flags: dedupe(Array.from(flags)),
      next_questions_for_detective: nextQs.slice(0,1).map(clamp),
      memory_updates: memory.map(clamp),
      suggested_stage_transition: (nextStage || "stay")
    };
  }
}

/* ---------------- HTTP handler ---------------- */
module.exports = function handler(req, res){
  setCORS(res);
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method!=="POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try{
    let body = req.body || {};
    if (typeof body === "string"){ try { body = JSON.parse(body); } catch { body = {}; } }

    const persona = (body.persona==="Freda") ? "Freda" : "Betty";
    const message = (body.message||"").toString();
    const history = (body.history||"").toString();

    const json = replyEngine({ persona, message, history });
    return res.status(200).json({ ok:true, json });
  }catch(e){
    return res.status(200).json({ ok:false, error:"Server error processing your message." });
  }
};
