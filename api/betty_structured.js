// /api/betty_structured.js
// Structured, scenario-aware interview bot for Storyline (Betty or Freda).
// Returns JSON: { ok:true, json:{ reply_text, tone_detected, stance, policy_points_referenced[], risk_flags[], next_questions_for_detective[], memory_updates[], suggested_stage_transition } }

function setCORS(res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Accept");
}

const PERSONAE = {
  Betty: { name: "Betty Morales", role: "Sales Executive at Acme Things Ltd." },
  Freda: { name: "Freda Morales", role: "Sales Executive at Acme Things Ltd." }
};

// Grounding facts
const FACTS = {
  gift: "luxury food and wine hamper",
  sender: "ClientCo (arranged by Raj)",
  delivery: "courier to Acme office",
  timing: "two weeks before a renewal decision meeting",
  valueRange: [150,220],
  card: "locking in the renewal",
  disclosureFiled: false, // hasn't filed yet
  mentionedInChat: true
};

// Policy gist
const POLICY = {
  giftApprovalThreshold: 25,
  requireDisclosureOver: 25,
  giftsLinkedToDecisionProhibited: true,
  actions: ["disclosure", "return", "donate", "manager notification"]
};

// ----------- helpers -----------
const MAX_CHARS = 600;
const clamp = s => (s||"").toString().slice(0, MAX_CHARS);
const norm = s => (s||"").toLowerCase();
function toneDetect(msg){
  const m = norm(msg);
  if (/(asap|quick|hurry|now|urgent)/.test(m)) return "rushed";
  if (/(policy|section|per|threshold|disclosure form|compliance)/.test(m)) return "legalistic";
  if (/(why did you|you should|you realise|breach|violate|against|wrong)/.test(m)) return "accusatory";
  if (/(can you walk me|talk me through|help me understand|could you explain|what happened)/.test(m) || (m.match(/\?/g)||[]).length>=2) return "probing";
  if (/(thanks|appreciate|that helps|no worries|we’ll sort this)/.test(m)) return "supportive";
  return "neutral";
}
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] } // used minimally for naturalness

function stanceFromTone(t, history){
  if (t==="accusatory") return "defensive";
  if (/disclosure|over\s*25|return|donate|manager/i.test(history||"")) return "cooperative";
  if (t==="probing"||t==="neutral") return "curious";
  if (t==="legalistic") return "minimizing";
  return "cooperative";
}

function risksFromContext(message){
  const risks = [];
  const m = norm(message);
  // base scenario risks
  risks.push("high_value_gift(£150–£220)");
  risks.push("near_decision_timing(2_weeks_pre_renewal)");
  risks.push("explicit_intent_card('locking in the renewal')");
  risks.push("no_disclosure_filed");
  // message cues
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

function replyEngine({persona, message, history}){
  const who = persona==="Freda" ? PERSONAE.Freda : PERSONAE.Betty;
  const tone = toneDetect(message);
  let stance = stanceFromTone(tone, history);

  // Decide stage & answer content
  const m = norm(message);
  let reply = "";
  const pp = []; // policy points referenced in reply
  const flags = risksFromContext(message);
  const nextQs = [];
  const memory = [];
  let stage = "stay";

  // --- DETECTIVE EXPLAINS POLICY clearly -> cooperative compliance
  const learnerExplainedPolicy = /(over\s*25|£\s*25).*(disclosure|form)|gifts.*(decision|renewal).*prohibit|when in doubt.*(disclose|return|donate)/i.test(m);
  if (learnerExplainedPolicy) stance = "cooperative";

  // --- Core branches (answer first, then an optional single follow-up if helpful)
  if (mentions(m, /(what.*happened|tell.*about|how.*came|who sent|when.*delivered)/i)){
    reply = `It arrived by courier at reception about two weeks ago. ClientCo sent it—Raj arranged it. The card mentioned “locking in the renewal”.`;
    memory.push("facts_confirmed:delivery/sender/timing/card");
  }
  else if (mentions(m, /(how much|value|worth|price|estimate)/i)){
    reply = `It looked like a high-end hamper, probably £150–£220 with the wine.`;
    memory.push("facts_confirmed:approx_value_150-220");
    if (!/(disclos|form)/.test(m)) { nextQs.push("Do you want me to file the disclosure now?"); }
  }
  else if (mentions(m, /(did you disclose|disclosure|form|register|log)/i)){
    reply = `I haven’t filed the disclosure yet—I only mentioned it in team chat. I can complete the form now.`;
    pp.push("use_disclosure_form"); memory.push("facts_confirmed:no_disclosure_filed");
    stage = "advance";
  }
  else if (mentions(m, /(keep|keep it|accept|take|hold onto)/i) && /(gift|hamper|wine)/i.test(m)){
    // Apply policy in plain language
    reply = `Given the value and the renewal timing, I shouldn’t keep it. I’ll submit the disclosure and arrange to return or donate it, and notify my manager.`;
    pp.push("gifts_tied_to_decisions_prohibited","use_disclosure_form","return_or_donate_when_in_doubt","notify_manager");
    stage = "escalate_to_policy_coaching";
  }
  else if (mentions(m, /(this breaches policy|against policy|not allowed)/i) || tone==="legalistic"){
    reply = `I understand—gifts over £${POLICY.giftApprovalThreshold} need pre-approval, and anything linked to the renewal is not allowed. I’ll sort the disclosure and donate the hamper.`;
    pp.push("gifts_over_25_require_pre-approval_disclosure","gifts_tied_to_decisions_prohibited","return_or_donate_when_in_doubt");
    stance = "cooperative"; stage = "advance";
  }
  else if (mentions(m, /(why|how).*different.*(dinner|meal|hospitality)/i)){
    reply = `Dinners can be pre-approved as hospitality, but the hamper is a gift tied to a decision and wasn’t disclosed. That’s why it’s riskier.`;
    pp.push("gifts_tied_to_decisions_prohibited","use_disclosure_form");
    stage = "advance";
  }
  else if (mentions(m, /(next step|what now|what should you do|what do i do|plan)/i)){
    reply = `I’ll file the disclosure today, then donate the hamper to avoid any appearance of influence. I’ll also notify my manager.`;
    pp.push("use_disclosure_form","return_or_donate_when_in_doubt","notify_manager");
    stage = "close_and_commit";
  }
  else {
    // Generic but scenario-anchored response; keep short; one helpful follow-up max
    reply = `It was a ClientCo hamper delivered to reception, about £150–£220, two weeks before the renewal meeting. The card said “locking in the renewal”.`;
    if (!/(value|worth)/.test(m)) nextQs.push("Do you want the exact value logged on the disclosure?");
    stage = "stay";
  }

  // If tone accusatory, allow a touch of defensiveness but still comply once policy appears
  if (tone==="accusatory" && stance!=="cooperative"){
    reply = reply + " I didn’t ask for it, but I get the concern.";
    stance = "defensive";
  }

  // ensure reply is concise and plain
  reply = clamp(reply);

  // Add automatic policy points when reply references actions
  if (/disclos/.test(reply)) pp.push("use_disclosure_form");
  if (/return|donate/.test(reply)) pp.push("return_or_donate_when_in_doubt");
  if (/manager/.test(reply)) pp.push("notify_manager");

  // dedupe arrays
  const dedupe = arr => Array.from(new Set(arr));
  return {
    persona: who.name,
    reply_text: reply,
    tone_detected: tone,
    stance: stance,
    policy_points_referenced: dedupe(pp),
    risk_flags: dedupe(flags),
    next_questions_for_detective: nextQs.slice(0,1), // at most one
    memory_updates: memory,
    suggested_stage_transition: stage
  };
}

// ---------------- handler ----------------
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
