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
      gifts_and_hospitality_re_
