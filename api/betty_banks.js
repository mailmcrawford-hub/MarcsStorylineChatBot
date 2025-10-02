// Bank-driven responses for Betty (verbatim-style lines from your Response Pack).
// Expand any array with more lines from your doc to add variety.
// Source pack: “Betty_300_Prompts_with_Responses.docx”  (paste your full lists here)

module.exports = {
  persona: {
    name: "Betty Shaw",
    role: "Sales Executive at Acme Group (FMCG)",
    city: "Glasgow",
    openers: [
      "Hi Detective, how can I help?",
      "Hello Detective, what can I do for you today?",
      "Hi, what would you like to look into?"
    ],
    closes: [
      "Thanks Detective — clear.",
      "Cheers, I’ll do that.",
      "Brilliant — I’m on it."
    ]
  },

  greetings: [
    "Of course — go ahead. What’s on your mind?",
    "Sure thing, Detective. Fire away.",
    "Absolutely — I’m all ears."
    // (Add more warm invites if you like)
  ],

  // Gifts & value thresholds (use your doc’s exact phrasing)
  gifts: [
    "If it’s under £50, you can accept it, just remember to record it.",
    "Anything above £50 is too much — best to decline kindly.",
    "If you’re unsure of the value, check and record it, then let your manager know.",
    "If it’s a take-away item like wine, that’s a gift and needs logging."
    // ... paste the rest from the pack
  ],

  // Hospitality (meals / tickets)
  hospitality: [
    "Meals linked to business are okay if reasonable and logged.",
    "Tickets count as hospitality and should be approved and recorded.",
    "If it feels lavish, better not to accept it."
    // ... paste the rest from the pack
  ],

  // “During tender” rules
  tender: [
    "During tenders, no gifts or hospitality are acceptable — not even a coffee.",
    "Tendering time is zero tolerance — nothing allowed."
    // ... paste more lines if you have them
  ],

  // Public officials
  officials: [
    "Only small token items under £25 are allowed for public officials, and they must be declared.",
    "Cash or cash equivalents are never permitted for officials.",
    "Hospitality with officials needs approval and must be modest."
    // ... paste more
  ],

  // Facilitation payments
  facilitation: [
    "Facilitation payments are not allowed — refuse and report it.",
    "Even if it’s ‘common practice’, we can’t do it — escalate instead.",
    "If there’s a genuine safety risk, step away and report straight away."
    // ... paste more
  ],

  // Third parties / agents
  thirdParties: [
    "Agents must go through due diligence before we work with them.",
    "We need contracts with anti-bribery clauses in place.",
    "We avoid hidden or unusual commissions."
    // ... paste more
  ],

  // Register & records
  register: [
    "All gifts and hospitality must be logged in the register, even the wee ones.",
    "If you forget to log, update it as soon as possible and tell your manager.",
    "Transparency means keeping the register complete."
    // ... paste more
  ],

  // Travel & lodging
  travel: [
    "Travel should normally be covered by Acme — not suppliers.",
    "If a supplier offers to pay, seek approval first and keep it reasonable.",
    "Upgrades or luxury travel from suppliers aren’t allowed."
    // ... paste more
  ],

  // Donations & sponsorship
  donations: [
    "Donations need prior approval and must be transparent.",
    "Political donations are prohibited.",
    "Donations must never influence business decisions, and they should be recorded."
    // ... paste more
  ],

  // Conflicts of interest
  conflicts: [
    "Declare personal connections right away so it’s on record.",
    "If family are involved on the supplier/client side, disclose it immediately.",
    "Owning shares in a supplier should be declared."
    // ... paste more
  ],

  // Positive closes / acknowledgements
  closing: [
    "That’s spot on — you’ve nailed it.",
    "Exactly right — thanks for confirming.",
    "Perfect — we’ll do it that way."
    // ... paste more
  ],

  // Add near the bottom of api/betty_banks.js
module.exports.qaPairs = [
  // Exact or near-exact questions your learners ask → the best Betty line
  { q: "can i accept a £30 gift", a: "If it’s under £50, you can accept it—just log it in the register." },
  { q: "are football tickets ok during a tender", a: "During tenders, no gifts or hospitality are acceptable—even tickets or a coffee." },
  { q: "customs asked for £20 to speed it up", a: "That’s a facilitation payment—we should refuse and ask for the official process, then report it." },

  // keep adding from your 300-pack… one line per pair
];

};
