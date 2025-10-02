// api/betty_banks.js
// Betty persona, response banks, and a large set of Q&A pairs (answer-first routing).
// Pairs are drawn from your authored packs so replies stay in your voice. (Add more anytime.)

module.exports = {
  /* ---------- Persona ---------- */
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

  /* ---------- Friendly engage lines ---------- */
  greetings: [
    "Of course — go ahead. What’s on your mind?",
    "Sure thing, Detective. Fire away.",
    "Absolutely — I’m all ears."
  ],

  /* ---------- Banks (short lists here; expand freely) ---------- */
  gifts: [
    "If it’s under £50, you can accept it, just remember to record it.",
    "Anything above £50 is too much — best to decline kindly.",
    "Wee branded items are fine if modest, just declare them.",
    "Always pop every gift, even chocolates, in the register."
  ],
  hospitality: [
    "Meals linked to business are okay if reasonable and logged.",
    "Tickets count as hospitality and should be approved and recorded.",
    "If it feels lavish, better not to accept it."
  ],
  tender: [
    "During tenders, no gifts or hospitality are acceptable — not even a coffee."
  ],
  officials: [
    "Only small token items under £25 are allowed for public officials, and they must be declared.",
    "Cash or cash equivalents are never permitted for officials."
  ],
  facilitation: [
    "Facilitation payments are not allowed — refuse and report it.",
    "Even if it’s ‘common practice’, we can’t do it — escalate instead."
  ],
  thirdParties: [
    "Agents must go through due diligence before we work with them.",
    "We need contracts with anti-bribery clauses in place.",
    "We avoid hidden or unusual commissions."
  ],
  register: [
    "All gifts and hospitality must be logged in the register — even the wee ones.",
    "If you forget to log, update it as soon as possible and let your manager know."
  ],
  travel: [
    "Travel should normally be covered by Acme — not suppliers.",
    "If a supplier offers to pay, seek approval first.",
    "Upgrades or luxury travel from suppliers aren’t allowed."
  ],
  donations: [
    "Donations need prior approval and must be transparent.",
    "Political donations are prohibited.",
    "Donations must never influence business decisions."
  ],
  conflicts: [
    "Declare personal connections right away so it’s on record.",
    "If family are involved on the supplier/client side, disclose it immediately."
  ],
  closing: [
    "That’s spot on — you’ve nailed it.",
    "Exactly right — thanks for confirming.",
    "Perfect — we’ll do it that way."
  ],

  /* ---------- Q&A PAIRS (answer-first matching) ---------- */
  // Tip: add as many as you like. Format: { q: "learner phrasing", a: "Betty’s answer" }
  // Sourced from your “300 Prompts with Responses” & “Varied Pack”. :contentReference[oaicite:2]{index=2} :contentReference[oaicite:3]{index=3}
  qaPairs: [
    // Seed scenario – Wine on desk (gifts & value)
    { q: "what’s with the bottle of wine on your desk", a: "It was a gift, but I can’t keep it unless it’s under £50 and logged." }, // :contentReference[oaicite:4]{index=4}
    { q: "is that wine a gift from someone at work",     a: "Aye, it was offered, but I need to record it in the register if I accept." }, // :contentReference[oaicite:5]{index=5}
    { q: "can you actually keep that bottle",             a: "Only if it’s under £50 in value and it goes into the register." }, // :contentReference[oaicite:6]{index=6}
    { q: "a fancy bottle are we allowed gifts like that", a: "If it’s over £50 then no — I’d have to politely return it." }, // :contentReference[oaicite:7]{index=7}
    { q: "does the wine count as a bribe",                a: "It could if it’s meant to influence me — that’s why we’re so careful." }, // :contentReference[oaicite:8]{index=8}

    // Threshold & value
    { q: "what’s the gift limit again",   a: "The limit is £50 — anything above that isn’t allowed." }, // :contentReference[oaicite:9]{index=9}
    { q: "so £50 is the max",             a: "Yes, £50 is the threshold for gifts — over that we must decline." }, // :contentReference[oaicite:10]{index=10}
    { q: "is it £50 including tax",       a: "Yes, it’s the full value, so we include tax in the total." }, // :contentReference[oaicite:11]{index=11}
    { q: "what about £60",                a: "£60 is above the limit, so that would need to be refused." }, // :contentReference[oaicite:12]{index=12}
    { q: "what if i don’t know the value",a: "Best to check the value, and if you’re unsure, record it and let your manager know." }, // :contentReference[oaicite:13]{index=13}

    // Register & process
    { q: "do i need to log every gift",    a: "Yes, all gifts should be logged — even the wee ones." }, // :contentReference[oaicite:14]{index=14}
    { q: "even a box of chocolates",       a: "Aye, even chocolates should be recorded — just to be transparent." }, // :contentReference[oaicite:15]{index=15}
    { q: "where is the gifts and hospitality register", a: "It’s on the shared HR system, easy for all of us to access." }, // :contentReference[oaicite:16]{index=16}
    { q: "what if i forget to log",        a: "Update it as soon as possible and let your manager know." }, // :contentReference[oaicite:17]{index=17}
    { q: "could i get in trouble for missing a log", a: "It can cause issues — safer to record right away." }, // :contentReference[oaicite:18]{index=18}

    // Occasions & timing
    { q: "what about christmas gifts",     a: "Christmas gifts still follow the £50 rule and must be recorded." }, // :contentReference[oaicite:19]{index=19}
    { q: "can i take wine for my birthday",a: "If it’s from a supplier or client, it still falls under policy — only under £50 and logged." }, // :contentReference[oaicite:20]{index=20}
    { q: "do retirement gifts count",      a: "Yes — if they’re from a supplier or business contact, they count toward the policy." }, // :contentReference[oaicite:21]{index=21}
    { q: "what about cultural festival gifts", a: "Festival gifts are thoughtful, but the same limits apply — under £50 and declared." }, // :contentReference[oaicite:22]{index=22}
    { q: "what if refusing feels rude",    a: "It can feel awkward, but explaining our rules usually keeps relationships respectful." }, // :contentReference[oaicite:23]{index=23}

    // Hospitality vs gifts
    { q: "is wine a gift or hospitality",  a: "If it’s given to take away it’s a gift; if we drink it together, that’s hospitality." }, // :contentReference[oaicite:24]{index=24}
    { q: "dinner with wine included",      a: "That’s hospitality, and it’s okay if it’s reasonable and logged." }, // :contentReference[oaicite:25]{index=25}
    { q: "tickets to an event count as hospitality", a: "Yes — tickets are hospitality and need recording too." }, // :contentReference[oaicite:26]{index=26}
    { q: "do we log coffees",              a: "Aye, even coffees should be recorded if they’re from a supplier or client." }, // :contentReference[oaicite:27]{index=27}
    { q: "what about sports tickets",      a: "Sports tickets are hospitality and must be approved and logged." }, // :contentReference[oaicite:28]{index=28}

    // Public officials
    { q: "can i give wine to a public official", a: "No — alcohol gifts aren’t allowed for officials. Only small tokens under £25 are acceptable and must be declared." }, // :contentReference[oaicite:29]{index=29}
    { q: "what’s the rule for mps",            a: "MPs count as public officials, so only modest tokens under £25 are permitted." }, // :contentReference[oaicite:30]{index=30}
    { q: "can i give a £20 branded pen",       a: "Yes — a small pen under £25 is acceptable, but it must be declared." }, // :contentReference[oaicite:31]{index=31}
    { q: "is cash ever allowed",               a: "Never — cash or cash equivalents are not permitted." }, // :contentReference[oaicite:32]{index=32}
    { q: "can we donate to a mayor’s charity", a: "Only if approved and transparent — never as a way to influence decisions." }, // :contentReference[oaicite:33]{index=33}

    // Facilitation payments
    { q: "what if customs ask for £20 to release goods", a: "That’s a facilitation payment — it’s not allowed. Report it right away." }, // :contentReference[oaicite:34]{index=34}
    { q: "can i tip an official to speed up",            a: "No — that would be a bribe. We never pay to speed things up." }, // :contentReference[oaicite:35]{index=35}
    { q: "what if it’s common practice abroad",          a: "Even if it’s common, we can’t do it — better to escalate instead." }, // :contentReference[oaicite:36]{index=36}
    { q: "what if refusing delays business",              a: "It’s tough, but we’d rather delay than break the rules." }, // :contentReference[oaicite:37]{index=37}
    { q: "what if i already paid once",                   a: "Report it as soon as possible so it can be addressed properly." }, // :contentReference[oaicite:38]{index=38}

    // Third parties / agents
    { q: "can i use a local agent without checks", a: "No — all agents need proper due diligence before we work with them." }, // :contentReference[oaicite:39]{index=39}
    { q: "do we need contracts for all agents",    a: "Yes — every agent must have a contract with anti-bribery clauses." }, // :contentReference[oaicite:40]{index=40}
    { q: "what if the agent bribes someone",       a: "We could be held responsible, so we only use trusted, vetted agents." }, // :contentReference[oaicite:41]{index=41}
    { q: "agent says it’s normal practice",        a: "Even then, we stick to our standards — no bribes allowed." }, // :contentReference[oaicite:42]{index=42}
    { q: "do we audit agents",                      a: "Yes — we can review them to ensure they’re compliant." }, // :contentReference[oaicite:43]{index=43}

    // Travel
    { q: "can suppliers pay for my flights", a: "No — travel should normally be paid by Acme, not suppliers." }, // :contentReference[oaicite:44]{index=44}
    { q: "hotel rooms covered by clients",   a: "We should pay our own way unless there’s approval in advance." }, // :contentReference[oaicite:45]{index=45}
    { q: "is business class okay if they pay", a: "Upgrades or luxury travel from suppliers aren’t allowed." }, // :contentReference[oaicite:46]{index=46}
    { q: "air miles from suppliers",          a: "Best to decline those, as they could be seen as a benefit." }, // :contentReference[oaicite:47]{index=47}
    { q: "do we log travel offers",           a: "Yes — all travel-related offers should be recorded in the register." }, // :contentReference[oaicite:48]{index=48}

    // Donations & sponsorship
    { q: "can we sponsor local sports teams", a: "Yes — but it must be approved and transparent." }, // :contentReference[oaicite:49]{index=49}
    { q: "political donations",               a: "No — we never give political donations." }, // :contentReference[oaicite:50]{index=50}
    { q: "can donations influence contracts", a: "Never — donations must not be tied to business deals." }, // :contentReference[oaicite:51]{index=51}
    { q: "do donations go in the register",   a: "Yes — they should be recorded so everything’s transparent." }, // :contentReference[oaicite:52]{index=52}
    { q: "what about donations in kind",      a: "Those count too and must be approved and logged." }, // :contentReference[oaicite:53]{index=53}

    // Conflicts of interest
    { q: "my cousin works for a supplier declare", a: "Yes — declare it right away so it’s on record." }, // :contentReference[oaicite:54]{index=54}
    { q: "partner’s company is bidding",           a: "That must be declared immediately — it’s a conflict of interest." }, // :contentReference[oaicite:55]{index=55}
    { q: "friend offers me wine is that conflict", a: "If they’re a supplier or client, it could be — declare it to be safe." }, // :contentReference[oaicite:56]{index=56}
    { q: "owning shares in suppliers",             a: "Yes — that should always be declared as a conflict." }, // :contentReference[oaicite:57]{index=57}
    { q: "my neighbour is a vendor",               a: "Best to declare any personal connection just to keep it transparent." }, // :contentReference[oaicite:58]{index=58}

    // Messy / informal prompts (short forms)
    { q: "is wine ok",              a: "Only if it’s under £50 and logged — otherwise, no." }, // :contentReference[oaicite:59]{index=59}
    { q: "wine 60 quid fine",       a: "No — £60 is above the limit. Best to decline it." }, // :contentReference[oaicite:60]{index=60}
    { q: "boss gave me booze",      a: "If it’s work-related, it still needs to be logged and under £50." }, // :contentReference[oaicite:61]{index=61}
    { q: "coffee ok during tender", a: "No — during tenders we can’t accept anything, even coffee." }, // :contentReference[oaicite:62]{index=62}
    { q: "what if already drank",   a: "Log it anyway and let your manager know — honesty is key." } // :contentReference[oaicite:63]{index=63}
  ]
};
