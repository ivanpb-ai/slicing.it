import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   NORTHSTAR — THE NEXT DECADE
   A future-facing 5G SA vision presentation (2026 → 2036).

   ┌─────────────────────────────────────────────────────────────────────┐
   │  ✏️  TO EDIT THE TEXT: everything you can read on screen lives in the  │
   │      single `COPY` object below. Change the words inside the quotes.  │
   │      Keep the quotes, commas and braces. You never need to touch the  │
   │      layout/animation code further down.                              │
   │                                                                       │
   │  Quick rules:                                                         │
   │   • "plain text"                      → normal words                  │
   │   • { t: "word", c: P.cyan }          → a word in a colour            │
   │   • { t: "word", c: P.gold, b: true } → a bold coloured word          │
   │   • { t: "words", grad: [P.a, P.b] }  → gradient text                 │
   │   • { br: true }                      → a line break                  │
   │   • colours (P.cyan, P.gold, …) are listed in the palette `P`.        │
   └─────────────────────────────────────────────────────────────────────┘

   Embeds:  /5g-sa-architecture-diagram.html  and  /unified-5g-viz.html (iframes)
   ═══════════════════════════════════════════════════════════════════════ */

// ── Palette (colour names you can use in the COPY block) ─────────────────
const P = {
  // Telia base
  deep:    "#29003E",
  dark:    "#3D1556",
  card:    "#4A1969",
  purple:  "#990AE3",
  light:   "#F4E0FF",
  magenta: "#C23FE3",
  teal:    "#00827C",
  // Futuristic accents
  cyan:    "#00D4FF",
  electric:"#7DD3FC",
  gold:    "#FFD740",
  green:   "#69F0AE",
  red:     "#FF5252",
  orange:  "#FF8A65",
  // Text tones
  white:   "#FFFFFF",
  dim:     "rgba(244,224,255,0.65)",
  muted:   "rgba(244,224,255,0.4)",
  faint:   "rgba(244,224,255,0.15)",
};

const FF_HEAD = "'Telia Sans Heading', 'Telia Sans', system-ui, sans-serif";
const FF_BODY = "'Telia Sans', system-ui, sans-serif";
const FF_MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace";

// ═════════════════════════════════════════════════════════════════════════
// ✏️  ALL EDITABLE TEXT LIVES HERE
// ═════════════════════════════════════════════════════════════════════════
const COPY = {
  // Shared bits of chrome
  ui: {
    backLink: "← NorthStar",
    scrollHint: "SCROLL TO EXPLORE ↓",
    footer: "TELIA × ERICSSON · CO-FUNDED BY THE EUROPEAN UNION",
    roadmapTapHint: "Tap a year to explore milestones",
    roadmapMilestones: "NorthStar milestones", // shown as "2025 · NorthStar milestones"
  },

  // Nav-dot tooltips (one per section, in order)
  navLabels: [
    "", "Inflection", "Three Waves", "Inside the Core", "Live Slicing",
    "AI-Native", "Ambient (ISAC)", "Positioning", "Sky as Network",
    "Verticals 2035", "The $1.3T Shift", "Roadmap", "Toward 6G", "Vision",
  ],

  // 0 — HERO
  hero: {
    kicker: "NorthStar · 2026 → 2036",
    title: "The Next Decade",
    subtitle: [
      "When 5G Standalone stops being ", { t: "a network", c: P.cyan }, { br: true },
      "and becomes ", { t: "the platform of the planet.", grad: [P.magenta, P.gold] },
    ],
    stats: [
      { v: 1.3,    pre: "$", suf: "T", dec: 1, label: "Global 5G value pool by 2035" },
      { v: 25,     pre: "",  suf: "B", dec: 0, label: "Connected devices on 5G SA" },
      { v: 12,     pre: "",  suf: "×", dec: 0, label: "Enterprise ARPU uplift on slices" },
      { v: 99.999, pre: "",  suf: "%", dec: 3, label: "Sovereign-grade reliability" },
    ],
  },

  // 1 — THE INFLECTION POINT
  inflection: {
    kicker: "The Inflection Point",
    headline: [
      "We are ", { t: "here.", c: P.gold }, { br: true },
      { t: "And everything is about to change.", c: P.dim, size: "0.55em" },
    ],
    youAreHere: "2026 · You are here",
    eras: [
      { era: "2G",     y: "1991",  t: "Voice",        c: P.faint },
      { era: "3G",     y: "2001",  t: "Data",         c: P.faint },
      { era: "4G LTE", y: "2009",  t: "Fast pipes",   c: P.muted },
      { era: "5G NSA", y: "2019",  t: "Faster pipes", c: P.dim },
      { era: "5G SA",  y: "2024",  t: "Programmable", c: P.cyan },
      { era: "5G-Adv", y: "2026",  t: "Cognitive",    c: P.magenta },
      { era: "6G",     y: "2030+", t: "Ambient",      c: P.gold },
    ],
    note: [
      "Every prior generation gave us ", { t: "more bandwidth", c: P.dim, b: true },
      ". 5G Standalone gives us something fundamentally different: a network that is ",
      { t: "cloud-native", c: P.cyan, b: true }, ", ",
      { t: "sliceable", c: P.magenta, b: true }, ", ",
      { t: "programmable", c: P.gold, b: true }, ", and ready to become ",
      { t: "intelligent", c: P.green, b: true },
      ". The decade ahead is when that potential cashes in.",
    ],
  },

  // 2 — THREE WAVES
  waves: {
    kicker: "How the decade unfolds",
    headline: [
      "Three waves: ", { t: "Programmable", c: P.cyan }, " · ",
      { t: "Cognitive", c: P.magenta }, " · ", { t: "Ambient", c: P.gold },
    ],
    bands: [
      {
        tag: "Wave 1 · 2025–2027", title: "Programmable", icon: "⚙️", color: P.cyan,
        summary: "Network as software. Slices, APIs, edge breakout, on-demand QoS — the moment connectivity becomes a controllable resource.",
        bullets: [
          "Network slicing at scale across consumer, enterprise, mission-critical",
          "CAMARA APIs commercialised — Quality-on-Demand, Location, Device",
          "Edge breakout to 40+ Swedish nodes; AI nodes co-located",
          "L4S deployed end-to-end with first partner workloads",
        ],
      },
      {
        tag: "Wave 2 · 2027–2030", title: "Cognitive", icon: "🧠", color: P.magenta,
        summary: "Network as intelligence. AI inside the RAN, the core, the orchestration loop — predicting, healing, optimising in real time.",
        bullets: [
          "NWDAF-driven closed-loop assurance — proactive SLA management",
          "AI-native RAN: beam management, scheduling, energy adaptation",
          "Intent-based slice creation — describe outcomes, network configures itself",
          "Digital twin of the network for what-if planning and continuous tuning",
        ],
      },
      {
        tag: "Wave 3 · 2030–2035+", title: "Ambient", icon: "🌌", color: P.gold,
        summary: "Network as nervous system. The air itself becomes a sensor; the sky becomes a cell; the network becomes the platform of the planet.",
        bullets: [
          "Integrated Sensing & Communication (ISAC) as a paid service",
          "Direct-to-device satellite — seamless terrestrial/NTN handover",
          "Ambient IoT — trillions of battery-less devices via backscatter",
          "Post-quantum security & sovereign-grade slicing as default",
        ],
      },
    ],
  },

  // 3 — INSIDE THE CORE (iframe)
  core: {
    kicker: "Architecture · Interactive",
    headline: ["Inside the ", { t: "5G SA Core", c: P.purple }],
    body: "Slices, RRPs, 5QIs, DNNs — the programmable fabric beneath every future use case. Explore the relationships that turn one network into many purpose-built ones.",
  },

  // 4 — LIVE SLICING (iframe)
  slicing: {
    kicker: "Live Simulation",
    headline: ["Network slicing in ", { t: "real time", c: P.cyan }],
    body: "Watch slices, radio resource partitions and 5QI flows move across the network. Trigger an L4S simulation inside the Private RRP and observe graceful per-flow degradation under congestion.",
  },

  // 5 — AI-NATIVE NETWORKS
  ainative: {
    kicker: "Wave 2 · 2027–2030",
    headline: ["The network becomes ", { t: "cognitive", c: P.magenta }],
    body: "Closed-loop assurance powered by NWDAF, digital twins and AI-native RAN. The network observes itself, predicts failures before they happen, applies fixes — and learns from the result.",
    brainTitle: "AI Brain",
    brainSub: "NWDAF · DIGITAL TWIN",
    loop: [
      { x: 90,  y: 90,  label: "OBSERVE", sub: "RAN + Core + UE telemetry", color: P.cyan },
      { x: 430, y: 50,  label: "PREDICT", sub: "NWDAF · ML inference",      color: P.magenta },
      { x: 720, y: 110, label: "DECIDE",  sub: "Policy + intent reasoning", color: P.gold },
      { x: 720, y: 330, label: "APPLY",   sub: "Slice / 5QI / beam / power", color: P.green },
      { x: 430, y: 380, label: "VERIFY",  sub: "Real-time SLA evidence",    color: P.orange },
      { x: 90,  y: 330, label: "LEARN",   sub: "Feedback into the model",   color: P.light },
    ],
    points: [
      { color: P.cyan,    title: "Proactive SLA",        desc: "Predict slice degradation 30+ seconds before users feel it; reschedule resources first." },
      { color: P.magenta, title: "Intent-Based Slicing", desc: "Describe outcomes (\"sub-10ms for 200 robots\") — the orchestrator designs and deploys the slice." },
      { color: P.gold,    title: "Energy as a Metric",   desc: "AI tunes radio power, beam selection and sleep cycles for >40% lower energy per Gbit." },
      { color: P.green,   title: "Digital Twin Ops",     desc: "Run what-if scenarios against a live, continuously-trained twin before touching production." },
    ],
  },

  // 6 — AMBIENT / ISAC
  ambient: {
    kicker: "Wave 3 · 2030–2035",
    headline: ["The air itself becomes a ", { t: "sensor", c: P.gold }],
    body: [
      "Integrated Sensing & Communication (ISAC) reuses the same waveform that carries your data to detect drones, vehicles, people, weather — without cameras, without extra hardware. The network stops being a pipe and becomes ",
      { t: "a continuous, ambient sense", c: P.gold, b: true }, " of the physical world.",
    ],
    gnbLabel: "gNB · ISAC",
    targets: [
      { x: 28, y: 30, label: "Drone",   color: P.cyan },
      { x: 72, y: 22, label: "Vehicle", color: P.gold },
      { x: 80, y: 60, label: "Person",  color: P.green },
      { x: 22, y: 72, label: "Weather", color: P.magenta },
      { x: 60, y: 80, label: "Asset",   color: P.light },
    ],
    uses: [
      { icon: "🛸", title: "Drone airspace mapping",            desc: "Track tens of thousands of UAVs in real time for low-altitude traffic management." },
      { icon: "🌧️", title: "Weather & atmospheric sensing",     desc: "Detect rain cells, fog and pollution at street resolution — for cities, ports and farming." },
      { icon: "🚷", title: "Privacy-respecting presence",       desc: "Count and track without cameras: factories, hospitals, transport hubs." },
      { icon: "🛡️", title: "Defence-grade situational awareness", desc: "Sovereign sensing slice for armed forces & critical infrastructure." },
      { icon: "💸", title: "Sensing-as-a-Service",              desc: "A new revenue stream measured in queries-per-day, not Gbits." },
    ],
  },

  // 7 — POSITIONING
  positioning: {
    kicker: "Positioning Revolution",
    headline: ["From ", { t: "cell-ID guesses", c: P.muted }, " to ", { t: "centimetres", c: P.green }],
    body: "5G SA positioning fuses RAN measurements, RTK, AI inference and ISAC to deliver indoor + outdoor accuracy that GNSS-only systems can't touch.",
    ladder: [
      { era: "4G",           acc: "~50 m",  detail: "Cell-ID only",                color: P.muted },
      { era: "5G SA · 2025", acc: "~1–2 m", detail: "Indoor dot · RTK over 5G SA", color: P.cyan },
      { era: "2027–28",      acc: "<50 cm", detail: "AI fusion · ISAC · macro",    color: P.magenta },
      { era: "2030+",        acc: "<10 cm", detail: "Cross-tech · 6G upper mid",   color: P.green },
    ],
    examples: [
      { icon: "⛏️", what: "Underground mining navigation 750 m below the surface." },
      { icon: "🚑", what: "Locate medical assets in hospitals to the room — without GPS." },
      { icon: "🚛", what: "Lane-level vehicle positioning for autonomous corridors." },
    ],
  },

  // 8 — NTN
  ntn: {
    kicker: "Non-Terrestrial Networks",
    headline: ["The sky becomes part of ", { t: "the cell plan", c: P.cyan }],
    body: "Satellite and terrestrial converge into one fabric. Phones connect direct-to-satellite as easily as to a tower. Backhaul, IoT and emergency comms span deep mines to open oceans — with no dead zones.",
    items: [
      { y: "Now",     title: "Satellite as backhaul",          desc: "NorthStar explores LEO/MEO backhaul for nomadic & rural cells.",          c: P.cyan },
      { y: "2027",    title: "NR-NTN normative",               desc: "First handover-capable satellite 5G NR; IoT-NTN store-and-forward.",      c: P.magenta },
      { y: "2029–30", title: "Direct-to-device handsets",       desc: "Consumer phones speaking 5G to LEO sats — seamless terrestrial fallback.", c: P.gold },
      { y: "2031+",   title: "Regenerative payloads & 6G NTN", desc: "Full convergence: one core, many access types — aeronautical & maritime.", c: P.green },
    ],
  },

  // 9 — VERTICAL TRANSFORMATIONS
  verticals: {
    kicker: "Verticals in 2035",
    headline: ["What becomes ", { t: "ordinary", c: P.magenta }],
    body: "Each industry rebuilt on top of slicing, edge, ISAC, NTN and AI-native operations.",
    cards: [
      { icon: "⛏️", year: "2030", title: "Mining without humans underground", color: P.cyan,
        body: "Autonomous fleets coordinated by URLLC + cm-level positioning, supervised from surface — operations 24/7 without endangering people.",
        tech: "URLLC · 5G SA Positioning · Edge AI" },
      { icon: "🚑", year: "2028", title: "The ambulance becomes the hospital", color: P.red,
        body: "4K live video + ECG/ultrasound stream over dedicated slice. Hospital clinicians treat patients before arrival.",
        tech: "URLLC + eMBB · Slicing · Edge" },
      { icon: "🚗", year: "2030", title: "Autonomous corridors at scale", color: P.gold,
        body: "V2X sub-ms safety messages, edge handover between road segments, cooperative driving — Sweden's first nationwide corridor by 2030.",
        tech: "V2X · TSN · MEC · 5QI 86" },
      { icon: "🏭", year: "2029", title: "Lights-out factories", color: P.green,
        body: "TSN over 5G LAN replaces wired Ethernet; robots, AGVs and PLCs share a single deterministic wireless fabric.",
        tech: "TSN · URLLC · 5G LAN · 5QI 83" },
      { icon: "🛡️", year: "2030", title: "Sovereign mission-critical", color: P.purple,
        body: "Defence and emergency services run on dedicated slices with pre-emptive priority and assured availability.",
        tech: "Sovereign slice · MCX · Sensing" },
      { icon: "⚡", year: "2032", title: "Smart grids that self-balance", color: P.magenta,
        body: "Substations exchange synchronisation and load data within microseconds; demand response in real time.",
        tech: "TSN over 5G · 1588 PTP · Edge" },
      { icon: "🌾", year: "2030", title: "Precision agriculture at field scale", color: P.electric,
        body: "Tens of thousands of soil/livestock sensors per km² over RedCap/Ambient IoT; drones via NTN where there's no coverage.",
        tech: "RedCap · mMTC · NTN · Sensing" },
      { icon: "🎮", year: "2028", title: "Edge-rendered XR everywhere", color: P.gold,
        body: "AR glasses with no on-device GPU; rendering runs 8 ms away at the city edge.",
        tech: "eMBB · MEC · 5QI 80" },
      { icon: "🛰️", year: "2031", title: "Maritime, polar, aeronautical", color: P.green,
        body: "One 5G subscription works on tankers, planes and Arctic stations via integrated NTN. No more dead zones.",
        tech: "NR-NTN · Direct-to-Device · Slicing" },
    ],
  },

  // 10 — ECONOMY
  economy: {
    kicker: "The Business Model Shift",
    headline: ["From ", { t: "pipes", c: P.muted }, " to ", { t: "platforms", c: P.cyan }, " to ", { t: "experiences", c: P.gold }],
    body: "Connectivity revenue flattens as it commoditises. The new value pool — slices, exposed APIs, and sensing — grows faster every year of the decade.",
    caption: "Illustrative trajectory. Connectivity ARPU flattens as commoditisation accelerates; new value moves to slices, exposed APIs and sensing services.",
    legend: [
      { color: P.faint,   label: "Connectivity (commoditising)" },
      { color: P.cyan,    label: "Slices" },
      { color: P.magenta, label: "APIs (CAMARA)" },
      { color: P.gold,    label: "Sensing-as-a-Service" },
    ],
    // Chart data (numbers, $B). Years and four series; axisMax sets the scale.
    chart: {
      years:        ["2025", "2027", "2029", "2031", "2033", "2035"],
      connectivity: [100, 108, 112, 115, 116, 116],
      slices:       [4, 18, 36, 62, 90, 118],
      apis:         [1, 6, 22, 56, 108, 168],
      sensing:      [0, 1, 5, 18, 44, 84],
      axisMax: 400,
    },
    stats: [
      { v: "+10–25%",   l: "Consumer premium ARPU uplift", c: P.cyan },
      { v: "$200–500B", l: "Enterprise slice TAM by 2030",  c: P.magenta },
      { v: "$150B+",    l: "Network API economy (CAMARA)",  c: P.gold },
      { v: "$80B+",     l: "Sensing-as-a-Service by 2035",  c: P.green },
    ],
  },

  // 11 — ROADMAP
  roadmap: {
    kicker: "NorthStar Roadmap · 2025–2029",
    headline: ["Where Sweden builds the ", { t: "future, first", c: P.purple }],
    cats: [
      { id: "qos",      label: "QoS & Slicing",    icon: "⚙️" },
      { id: "apis",     label: "Network APIs",     icon: "🔌" },
      { id: "location", label: "Positioning",      icon: "📍" },
      { id: "edge",     label: "Edge & AI",        icon: "☁️" },
      { id: "iot",      label: "RedCap / IoT",     icon: "📶" },
      { id: "uplink",   label: "Uplink Boost",     icon: "📡" },
      { id: "v2x",      label: "V2X",              icon: "🚗" },
      { id: "latency",  label: "Low Latency / TSN", icon: "⚡" },
      { id: "other",    label: "Sensing & NTN",    icon: "🛰️" },
    ],
    // Year colours (not text — leave as-is unless you want to recolour a year)
    yearColors: { "2025": P.light, "2026": P.magenta, "2027": P.cyan, "2028": P.purple, "2029": P.gold },
    data: {
      "2025": {
        qos: ["Basic slice/DNN/5QI service modelling"],
        apis: ["Telia API Gateway integration", "CAMARA Quality-on-Demand API", "CAMARA Positioning & tracking API"],
        location: ["Indoor dot positioning ~1–2 m", "GNSS RTK over 5G SA — cm-level precision"],
        edge: ["Local & city-wide breakout deployment"],
        iot: ["RedCap for higher throughput at lower battery"],
        uplink: ["UL CA + UL SU-MIMO (3tx)"],
        v2x: ["V2X slice using 5QI 79"],
        latency: ["Introduction of L4S for stable low-latency streams"],
        other: ["SIB9 for 5G time sync"],
      },
      "2026": {
        qos: ["Advanced Slice/DNN/5QI service modelling"],
        apis: ["Geofencing CAMARA via ENL"],
        location: ["AI model for indoor positioning", "Outdoor positioning TA & AoA (~10–50 m)", "Passive 5G SA outdoor positioning"],
        edge: ["AI compute edge node integration", "More multi-tenant edge breakout nodes"],
        iot: ["DRX/eDRX power saving for RedCap"],
        uplink: ["Uplink configured grant"],
        v2x: ["Connected digital traffic signage", "Additional 5QIs for V2X"],
        latency: ["L4S E2E usage by first NorthStar partners"],
        other: ["ISAC/Sensing testing at Future by Lund", "Satellite as backhaul exploration"],
      },
      "2027": {
        qos: ["New templates for 5GAA & 5G-ACIA", "URSP for Windows/iOS/Android"],
        apis: ["Seamless authentication via CAMARA + SES", "Connectivity insights via CAMARA"],
        location: ["Improved indoor positioning through AI", "Macro positioning tuned & more precise"],
        edge: ["Rollout of distributed AI+Edge nodes", "Scaling edge breakout to 40+ city nodes"],
        iot: ["eRedCap for ultra-optimised battery"],
        uplink: ["Local mmWave (regulator dependent)"],
        v2x: ["Edge discovery / handover for vehicles"],
        latency: ["L4S rollout to several partners", "uRLLC enhancements (RAN)"],
        other: ["Early sensing + tracking ISAC scenarios", "Satellite as backhaul deployment", "Nomadic cells for underserved areas"],
      },
      "2028": {
        qos: ["Intent-based slice creation incl. QoS"],
        apis: ["CAMARA network slice booking", "Connectivity insights via CAMARA"],
        location: ["High-accuracy cross-tech positioning (macro ↔ indoor ↔ RTK)", "Improved positioning using ISAC"],
        edge: ["Edge breakout scaling to 100+ city nodes"],
        iot: ["RedCap and eRedCap device proliferation"],
        uplink: ["Expanded mmWave (regulator dependent)"],
        v2x: ["Remote control of vehicles in public-road trials"],
        latency: ["TSN for manufacturing & smart grids (5G LAN)", "Latency-prioritised scheduling for TSN"],
        other: ["ISAC deployed for public sector & defence", "NR-NTN & IoT-NTN early deployment"],
      },
      "2029": {
        qos: ["AI-based slice creation incl. QoS"],
        apis: ["Support for 20+ CAMARA APIs"],
        location: ["Mature positioning using ISAC", "Leaking-cable positioning exploration"],
        edge: ["Full NorthStar integration across AI + Edge + RAN"],
        iot: [],
        uplink: [],
        v2x: ["Autonomous-vehicle corridor tests"],
        latency: ["Mature TSN ecosystem"],
        other: ["Mature ISAC ecosystem", "Vertical 5G for aeronautics", "Full 5G/Satellite integration"],
      },
    },
  },

  // 12 — TOWARD 6G
  sixg: {
    kicker: "3GPP Standards · 2024 → 2035",
    headline: ["The bridge from ", { t: "5G-Advanced", c: P.cyan }, " to ", { t: "6G", c: P.gold }],
    body: "Every release lays a brick. By Rel-21, 6G is specified. By Rel-22+, it's commercial. Investing in 5G SA today buys the architectural runway for everything that follows.",
    items: [
      { rel: "Rel-18",  period: "2024",    label: "5G-Advanced",       color: P.cyan,    bullets: ["AI/ML for RAN", "NTN Phase 2", "XR support", "MBS efficient delivery"] },
      { rel: "Rel-19",  period: "2025–26", label: "5G-Adv. Phase 2",   color: P.magenta, bullets: ["AI/ML on the air interface", "NTN Phase 3", "ISAC channel modelling", "Ambient IoT"] },
      { rel: "Rel-20",  period: "2027–28", label: "Bridge to 6G",      color: P.gold,    bullets: ["6G study items kick off", "NTN/terrestrial convergence", "Sub-THz exploration", "FR3 (7–24 GHz)"] },
      { rel: "Rel-21",  period: "2029–30", label: "6G Specifications", color: P.green,   bullets: ["6G RAN specs", "AI-native architecture", "Post-quantum migration", "ITU IMT-2030"] },
      { rel: "Rel-22+", period: "2031–35", label: "6G Commercial",     color: P.light,   bullets: ["Holographic communication", "Sensing as a network service", "Sovereign sub-net slicing", "Energy-efficiency SLAs"] },
    ],
    note: {
      label: "⚠ IMPLEMENTATION REALITY:",
      text: " Standards take 1–3 years for vendors to implement and another 2–4 years for operators to integrate (BSS + OSS). Operators that invest in 5G SA now will have a 5-year head-start on the 6G era.",
    },
  },

  // 13 — VISION / CTA
  vision: {
    kicker: "2036",
    headline: [
      "The network won't be", { br: true },
      { t: "something you connect to.", c: P.dim }, { br: true }, { br: true },
      { t: "It will be everywhere you are.", grad: [P.cyan, P.light, P.magenta, P.gold], anim: true },
    ],
    body: "Sensing the world. Healing itself. Carrying intent, not just packets. Stretching from underground mines to low orbit. That's the network NorthStar is building — and the decade in which it arrives.",
    ctas: [
      { label: "Back to start →",      href: "index.html", primary: true },
      { label: "Open the simulations", href: "unified-5g-viz.html" },
      { label: "Talk to us",           href: "mailto:northstar@teliacompany.com?subject=NorthStar%20Future%20Vision" },
    ],
  },
};

// Section ids (structural — order matches COPY.navLabels)
const SECTIONS = [
  "hero", "inflection", "waves", "core", "slicing", "ainative", "ambient",
  "positioning", "ntn", "verticals", "economy", "roadmap", "sixg", "vision",
];

// ═════════════════════════════════════════════════════════════════════════
// Rich — renders a COPY text array (strings + styled segments) into spans.
// (You don't need to edit this; it just paints the words from COPY.)
// ═════════════════════════════════════════════════════════════════════════
function Rich({ parts }) {
  return (parts || []).map((p, i) => {
    if (typeof p === "string") return <span key={i}>{p}</span>;
    if (p.br) return <br key={i} />;
    if (p.grad) {
      return (
        <span key={i} style={{
          background: `linear-gradient(135deg, ${p.grad.join(", ")})`,
          WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
          ...(p.anim ? { backgroundSize: "200% 200%", animation: "shimmer 6s ease-in-out infinite" } : {}),
        }}>{p.t}</span>
      );
    }
    const st = {};
    if (p.c) st.color = p.c;
    if (p.size) st.fontSize = p.size;
    return p.b ? <strong key={i} style={st}>{p.t}</strong> : <span key={i} style={st}>{p.t}</span>;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// BACKGROUND: layered animated canvas
// ─────────────────────────────────────────────────────────────────────────
function NeuralNebula({ active }) {
  const ref = useRef(null);
  const raf = useRef(0);
  const t = useRef(0);
  const nodes = useRef([]);
  const last = useRef(active);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      cvs.width  = window.innerWidth  * dpr;
      cvs.height = window.innerHeight * dpr;
      cvs.style.width  = window.innerWidth  + "px";
      cvs.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const N = Math.min(Math.floor((window.innerWidth * window.innerHeight) / 24000), 90);
      nodes.current = Array.from({ length: N }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 0.8 + Math.random() * 1.6,
        hue: Math.random(),
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const palettePurple = [
      [80, 10, 140],
      [153, 10, 227],
      [194, 63, 227],
      [244, 224, 255],
    ];
    const paletteFuture = [
      [0, 130, 124],
      [0, 212, 255],
      [125, 211, 252],
      [105, 240, 174],
    ];

    const animate = () => {
      t.current += 0.0065;
      const time = t.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isFuture = active >= 5; // shift palette toward cyan/teal in future sections
      const palette = isFuture ? paletteFuture : palettePurple;

      if (last.current !== active) last.current = active;

      const g = ctx.createRadialGradient(w * 0.7, h * 0.3, 50, w * 0.5, h * 0.5, Math.max(w, h));
      g.addColorStop(0, isFuture ? "rgba(0, 130, 124, 0.22)" : "rgba(153, 10, 227, 0.22)");
      g.addColorStop(0.4, "rgba(61, 21, 86, 0.85)");
      g.addColorStop(1, "#1A0533");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.beginPath();
      const ax = w * 0.7 + Math.sin(time * 0.3) * 40;
      const ay = h * 0.3 + Math.cos(time * 0.2) * 28;
      ctx.arc(ax, ay, Math.min(w, h) * 0.48, -0.8 + Math.sin(time * 0.15) * 0.2, 1.5 + Math.cos(time * 0.1) * 0.3);
      ctx.strokeStyle = isFuture ? "rgba(0,212,255,0.10)" : "rgba(153,10,227,0.13)";
      ctx.lineWidth = 60;
      ctx.stroke();

      const ns = nodes.current;
      for (const n of ns) {
        n.x += n.vx + Math.sin(time + n.hue * 12) * 0.05;
        n.y += n.vy + Math.cos(time * 0.8 + n.hue * 9) * 0.05;
        if (n.x < -30) n.x = w + 20;
        if (n.x > w + 30) n.x = -20;
        if (n.y < -30) n.y = h + 20;
        if (n.y > h + 30) n.y = -20;
      }

      const maxD2 = 160 * 160;
      ctx.lineWidth = 0.6;
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i];
        for (let j = i + 1; j < ns.length; j++) {
          const b = ns[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxD2) {
            const k = 1 - d2 / maxD2;
            const c = palette[Math.floor((a.hue + b.hue) * 0.5 * palette.length) % palette.length];
            ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${k * 0.16})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const n of ns) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 2 + n.hue * 6.28);
        const c = palette[Math.floor(n.hue * palette.length) % palette.length];
        ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.55 * pulse})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (1 + pulse * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      if (active === 0 || active === 4 || active === 5) {
        const burst = 8;
        for (let k = 0; k < burst; k++) {
          const phase = (time * 0.6 + k / burst) % 1;
          const i1 = (k * 7) % ns.length;
          const i2 = (k * 13 + 3) % ns.length;
          const a = ns[i1], b = ns[i2];
          if (!a || !b) continue;
          const px = a.x + (b.x - a.x) * phase;
          const py = a.y + (b.y - a.y) * phase;
          const c = palette[3];
          ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.85)`;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener("resize", resize); };
  }, [active]);

  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

// ─────────────────────────────────────────────────────────────────────────
// COUNTER (large, animated)
// ─────────────────────────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "", active, duration = 1800, decimals = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) { setV(0); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(eased * to);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, active, duration]);
  const display = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
  return <span>{prefix}{display}{suffix}</span>;
}

// ─────────────────────────────────────────────────────────────────────────
// REVEAL — small utility for fade/translate
// ─────────────────────────────────────────────────────────────────────────
function Reveal({ active, delay = 0, children, y = 16, scale = 1, style }) {
  return (
    <div style={{
      opacity: active ? 1 : 0,
      transform: active ? "translateY(0) scale(1)" : `translateY(${y}px) scale(${scale === 1 ? 0.985 : scale})`,
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      ...style,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// THREE WAVES
// ─────────────────────────────────────────────────────────────────────────
function WaveBands({ active }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, width: "100%" }}>
      {COPY.waves.bands.map((b, i) => (
        <Reveal key={b.title} active={active} delay={0.2 + i * 0.14}>
          <div style={{
            background: `linear-gradient(180deg, ${b.color}0e, ${b.color}03)`,
            border: `1px solid ${b.color}30`,
            borderRadius: 18,
            padding: "22px 20px",
            minHeight: 360,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%",
              background: `radial-gradient(circle, ${b.color}33, transparent 70%)`, filter: "blur(8px)",
            }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 28, lineHeight: 1 }}>{b.icon}</div>
              <div style={{ fontFamily: FF_MONO, fontSize: 10, letterSpacing: 2, color: b.color, textTransform: "uppercase" }}>
                {b.tag}
              </div>
            </div>
            <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 36, color: P.white, marginBottom: 12, letterSpacing: -0.5 }}>
              {b.title}
            </div>
            <div style={{ fontSize: 13, color: P.dim, lineHeight: 1.6, marginBottom: 16 }}>{b.summary}</div>
            {b.bullets.map((tx, j) => (
              <div key={j} style={{ display: "flex", gap: 8, fontSize: 12, color: "rgba(244,224,255,0.78)", lineHeight: 1.55, marginBottom: 6 }}>
                <span style={{ color: b.color, fontSize: 8, marginTop: 7, flexShrink: 0 }}>◆</span>
                <span>{tx}</span>
              </div>
            ))}
          </div>
        </Reveal>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// AI-NATIVE — animated SVG closed-loop
// ─────────────────────────────────────────────────────────────────────────
function ClosedLoopSVG({ active }) {
  const stages = COPY.ainative.loop;
  return (
    <svg viewBox="0 0 820 460" style={{ width: "100%", height: 380, opacity: active ? 1 : 0, transition: "opacity 0.8s" }}>
      <defs>
        <radialGradient id="brain" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={P.purple} stopOpacity="0.55" />
          <stop offset="60%" stopColor={P.magenta} stopOpacity="0.18" />
          <stop offset="100%" stopColor={P.purple} stopOpacity="0" />
        </radialGradient>
        <filter id="g1" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <circle cx="410" cy="220" r="120" fill="url(#brain)" />
      <circle cx="410" cy="220" r="60" fill="none" stroke={P.light} strokeOpacity="0.18" strokeDasharray="3 5" />
      <text x="410" y="218" textAnchor="middle" fontFamily={FF_HEAD} fontWeight="300" fontSize="22" fill={P.white}>{COPY.ainative.brainTitle}</text>
      <text x="410" y="240" textAnchor="middle" fontFamily={FF_MONO} fontSize="10" letterSpacing="2" fill={P.light} opacity="0.6">{COPY.ainative.brainSub}</text>

      {stages.map((s, i) => {
        const next = stages[(i + 1) % stages.length];
        const d = `M ${s.x} ${s.y} Q ${(s.x + next.x) / 2} ${(s.y + next.y) / 2 + (i % 2 ? -40 : 40)} ${next.x} ${next.y}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={s.color} strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 6">
              <animate attributeName="stroke-dashoffset" from="0" to="-200" dur="3s" repeatCount="indefinite" />
            </path>
            <circle r="4" fill={s.color}>
              <animateMotion dur={`${3 + i * 0.2}s`} repeatCount="indefinite" path={d} />
              <animate attributeName="opacity" values="0.2;1;0.2" dur="3s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}

      {stages.map((s) => (
        <g key={s.label} transform={`translate(${s.x},${s.y})`}>
          <circle r="34" fill={`${s.color}22`} stroke={s.color} strokeWidth="1.5" />
          <circle r="34" fill={`${s.color}10`} filter="url(#g1)" />
          <text textAnchor="middle" y="-2" fontFamily={FF_MONO} fontSize="11" fontWeight="700" letterSpacing="1.5" fill={s.color}>{s.label}</text>
          <text textAnchor="middle" y="14" fontFamily={FF_BODY} fontSize="9" fill={P.dim}>{s.sub}</text>
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ISAC RADAR
// ─────────────────────────────────────────────────────────────────────────
function ISACVisual({ active }) {
  return (
    <div style={{
      position: "relative", aspectRatio: "1.6 / 1", width: "100%", maxWidth: 540, margin: "0 auto",
      borderRadius: 16, background: `radial-gradient(circle at 30% 50%, ${P.purple}22, transparent 70%)`,
      border: `1px solid ${P.purple}33`, overflow: "hidden",
    }}>
      <style>{`
        @keyframes radarRing { 0% { transform: scale(0.05); opacity: 0.7; } 100% { transform: scale(1); opacity: 0; } }
        @keyframes targetBlink { 0%, 100% { opacity: 0.25; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.2); } }
      `}</style>
      <div style={{ position: "absolute", left: 28, top: "50%", transform: "translateY(-50%)", textAlign: "center", zIndex: 3 }}>
        <div style={{
          width: 46, height: 46, borderRadius: "50%",
          background: `radial-gradient(circle, ${P.cyan}, ${P.purple}aa)`,
          boxShadow: `0 0 30px ${P.cyan}88`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
        }}>📡</div>
        <div style={{ fontFamily: FF_MONO, fontSize: 9, color: P.light, marginTop: 6, letterSpacing: 1 }}>{COPY.ambient.gnbLabel}</div>
      </div>
      {active && [0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute", left: 50, top: "50%", width: "120%", aspectRatio: "1/1", borderRadius: "50%",
          border: `1px solid ${P.cyan}55`, transform: "translateY(-50%)", transformOrigin: "center",
          animation: `radarRing 3.6s ease-out ${i * 1.2}s infinite`,
        }} />
      ))}
      {COPY.ambient.targets.map((tg, i) => (
        <div key={i} style={{
          position: "absolute", left: `${tg.x}%`, top: `${tg.y}%`,
          opacity: active ? 1 : 0, transition: `opacity 0.6s ease ${0.4 + i * 0.12}s`,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: "50%", background: tg.color, boxShadow: `0 0 18px ${tg.color}cc`,
            animation: "targetBlink 2.4s ease-in-out infinite", animationDelay: `${i * 0.4}s`,
          }} />
          <div style={{ fontFamily: FF_MONO, fontSize: 9, color: tg.color, marginTop: 4, letterSpacing: 1, whiteSpace: "nowrap" }}>{tg.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// NTN ORBITAL
// ─────────────────────────────────────────────────────────────────────────
function OrbitalView({ active }) {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 460, aspectRatio: "1/1", margin: "0 auto" }}>
      <style>{`
        @keyframes orbit1 { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes orbit2 { from { transform: rotate(360deg); } to { transform: rotate(0); } }
      `}</style>
      <div style={{
        position: "absolute", inset: "30%", borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, ${P.teal}, ${P.dark} 70%)`,
        boxShadow: `0 0 60px ${P.teal}66, inset -20px -20px 60px ${P.deep}`,
        opacity: active ? 1 : 0, transition: "opacity 0.8s",
      }} />
      <div style={{
        position: "absolute", inset: "22%", borderRadius: "50%",
        background: `radial-gradient(circle, transparent 60%, ${P.cyan}22)`, filter: "blur(8px)",
      }} />
      <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: `1px dashed ${P.light}33`, animation: active ? "orbit1 24s linear infinite" : "none" }}>
        <div style={{ position: "absolute", top: "-8px", left: "50%", width: 16, height: 16, transform: "translateX(-50%)", fontSize: 16 }}>🛰️</div>
      </div>
      <div style={{ position: "absolute", inset: 32, borderRadius: "50%", border: `1px dashed ${P.cyan}44`, animation: active ? "orbit2 18s linear infinite" : "none" }}>
        <div style={{ position: "absolute", bottom: "-6px", left: "30%", width: 14, height: 14, fontSize: 14 }}>🛰️</div>
      </div>
      <div style={{ position: "absolute", inset: 56, borderRadius: "50%", border: `1px dashed ${P.magenta}44`, animation: active ? "orbit1 14s linear infinite" : "none" }}>
        <div style={{ position: "absolute", top: "30%", right: "-6px", width: 14, height: 14, fontSize: 14 }}>📡</div>
      </div>
      <svg viewBox="0 0 200 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <line x1="100" y1="10" x2="100" y2="80"   stroke={P.cyan}    strokeOpacity={active ? 0.4 : 0} strokeWidth="1" strokeDasharray="2 3">
          <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1s" repeatCount="indefinite" />
        </line>
        <line x1="40"  y1="160" x2="80" y2="110"  stroke={P.magenta} strokeOpacity={active ? 0.4 : 0} strokeWidth="1" strokeDasharray="2 3">
          <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1.2s" repeatCount="indefinite" />
        </line>
        <line x1="190" y1="80"  x2="120" y2="100" stroke={P.gold}    strokeOpacity={active ? 0.4 : 0} strokeWidth="1" strokeDasharray="2 3">
          <animate attributeName="stroke-dashoffset" from="0" to="20" dur="0.9s" repeatCount="indefinite" />
        </line>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// VERTICAL CARD
// ─────────────────────────────────────────────────────────────────────────
function VerticalCard({ icon, title, year, body, tech, color, active, delay }) {
  return (
    <Reveal active={active} delay={delay}>
      <div style={{
        background: `linear-gradient(180deg, ${color}10, ${color}02)`,
        border: `1px solid ${color}30`, borderRadius: 16, padding: "20px 18px",
        position: "relative", overflow: "hidden", height: "100%", boxSizing: "border-box",
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, background: `radial-gradient(circle at 90% 10%, ${color}, transparent 60%)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 26 }}>{icon}</span>
          <div>
            <div style={{ fontFamily: FF_MONO, fontSize: 10, letterSpacing: 2, color }}>BY {year}</div>
            <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 18, color: P.white, lineHeight: 1.1 }}>{title}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: P.dim, lineHeight: 1.55, marginBottom: 10 }}>{body}</div>
        <div style={{ fontFamily: FF_MONO, fontSize: 10, color: color, opacity: 0.9, letterSpacing: 1 }}>{tech}</div>
      </div>
    </Reveal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ECONOMY — animated area chart
// ─────────────────────────────────────────────────────────────────────────
function EconomyChart({ active }) {
  const { years, connectivity, slices, apis, sensing, axisMax: max } = COPY.economy.chart;
  return (
    <div style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginBottom: 10, fontSize: 11, fontFamily: FF_MONO }}>
        {COPY.economy.legend.map((lg, i) => <Legend key={i} color={lg.color} label={lg.label} />)}
      </div>

      <svg viewBox="0 0 800 320" style={{ width: "100%", height: 300 }}>
        <defs>
          <linearGradient id="grad-cy" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={P.cyan} stopOpacity="0.85" />
            <stop offset="100%" stopColor={P.cyan} stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="grad-ma" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={P.magenta} stopOpacity="0.85" />
            <stop offset="100%" stopColor={P.magenta} stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="grad-go" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={P.gold} stopOpacity="0.85" />
            <stop offset="100%" stopColor={P.gold} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {[0, 100, 200, 300].map(v => (
          <g key={v}>
            <line x1="50" x2="780" y1={280 - (v / max) * 240} y2={280 - (v / max) * 240} stroke={P.faint} strokeDasharray="2 4" />
            <text x="40" y={284 - (v / max) * 240} textAnchor="end" fontSize="9" fill={P.muted} fontFamily={FF_MONO}>${v}B</text>
          </g>
        ))}

        <path d={makePath(years, connectivity, max, active)} fill="none" stroke={P.faint} strokeWidth="2" strokeDasharray="6 4" />
        <path d={makeArea(years, slices,  max, active)} fill="url(#grad-cy)" opacity={active ? 0.7 : 0} style={{ transition: "opacity 1s" }} />
        <path d={makeArea(years, apis,    max, active)} fill="url(#grad-ma)" opacity={active ? 0.7 : 0} style={{ transition: "opacity 1.2s" }} />
        <path d={makeArea(years, sensing, max, active)} fill="url(#grad-go)" opacity={active ? 0.6 : 0} style={{ transition: "opacity 1.4s" }} />

        {years.map((y, i) => (
          <text key={y} x={50 + i * 146} y="305" textAnchor="middle" fontSize="11" fill={P.dim} fontFamily={FF_MONO}>{y}</text>
        ))}
      </svg>

      <div style={{ fontSize: 11, color: P.muted, fontStyle: "italic", textAlign: "center", marginTop: 6 }}>
        {COPY.economy.caption}
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: P.dim }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />{label}
    </span>
  );
}

function makePath(years, vals, max, active) {
  const w = 730 / (years.length - 1);
  return vals.map((v, i) => {
    const x = 50 + i * w;
    const y = 280 - (active ? (v / max) * 240 : 0);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
}
function makeArea(years, vals, max, active) {
  const w = 730 / (years.length - 1);
  const top = vals.map((v, i) => {
    const x = 50 + i * w;
    const y = 280 - (active ? (v / max) * 240 : 0);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  return `${top} L 780 280 L 50 280 Z`;
}

// ─────────────────────────────────────────────────────────────────────────
// ROADMAP TIMELINE
// ─────────────────────────────────────────────────────────────────────────
function RoadmapView({ active }) {
  const data = COPY.roadmap.data;
  const cats = COPY.roadmap.cats;
  const YEAR_COLOR = COPY.roadmap.yearColors;
  const years = Object.keys(data);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (active && open === null) {
      const t = setTimeout(() => setOpen(0), 600);
      return () => clearTimeout(t);
    }
  }, [active, open]);

  return (
    <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {years.map((y, i) => (
          <div key={y} onClick={() => setOpen(open === i ? null : i)}
               style={{
                 flex: 1, cursor: "pointer",
                 opacity: active ? 1 : 0,
                 transform: active ? "translateY(0)" : `translateY(${28 + i * 8}px)`,
                 transition: `all 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 0.08}s`,
               }}>
            <div style={{
              height: 7, borderRadius: 4, background: YEAR_COLOR[y], marginBottom: 12,
              boxShadow: open === i ? `0 0 20px ${YEAR_COLOR[y]}aa` : `0 0 10px ${YEAR_COLOR[y]}55`,
              transition: "box-shadow 0.3s",
            }} />
            <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 22, color: open === i ? YEAR_COLOR[y] : P.white, textAlign: "center" }}>{y}</div>
          </div>
        ))}
      </div>
      {open !== null && (() => {
        const y = years[open];
        const color = YEAR_COLOR[y];
        const d = data[y];
        return (
          <div style={{ background: `${color}10`, border: `1px solid ${color}40`, borderRadius: 18, padding: "22px 26px", animation: "fadeSlideUp 0.4s ease" }}>
            <div style={{ fontFamily: FF_MONO, fontSize: 11, color, letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" }}>
              {y} · {COPY.ui.roadmapMilestones}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px 24px" }}>
              {cats.map(c => {
                const items = d[c.id] || [];
                if (!items.length) return null;
                return (
                  <div key={c.id}>
                    <div style={{
                      fontSize: 11, fontFamily: FF_MONO, color: `${color}dd`, letterSpacing: 1,
                      textTransform: "uppercase", marginBottom: 6, borderBottom: `1px solid ${color}33`, paddingBottom: 4,
                      display: "flex", gap: 6, alignItems: "center",
                    }}>
                      <span style={{ fontSize: 13 }}>{c.icon}</span>{c.label}
                    </div>
                    {items.map((it, j) => (
                      <div key={j} style={{ fontSize: 12, color: "rgba(244,224,255,0.78)", lineHeight: 1.55, marginBottom: 3, display: "flex", gap: 6 }}>
                        <span style={{ color, fontSize: 8, marginTop: 6, flexShrink: 0 }}>◆</span>{it}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      {open === null && (
        <div style={{ textAlign: "center", color: P.muted, fontSize: 12, fontStyle: "italic", marginTop: 16 }}>
          {COPY.ui.roadmapTapHint}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 6G TIMELINE
// ─────────────────────────────────────────────────────────────────────────
function SixGRoadmap({ active }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, width: "100%", maxWidth: 980, margin: "0 auto" }}>
      {COPY.sixg.items.map((it, i) => (
        <Reveal key={it.rel} active={active} delay={0.15 + i * 0.1}>
          <div style={{
            background: `linear-gradient(180deg, ${it.color}0e, transparent)`,
            border: `1px solid ${it.color}30`, borderRadius: 14, padding: "16px 14px", minHeight: 220,
          }}>
            <div style={{ height: 5, background: it.color, borderRadius: 3, marginBottom: 10, boxShadow: `0 0 10px ${it.color}aa` }} />
            <div style={{ fontFamily: FF_MONO, fontSize: 11, fontWeight: 700, color: it.color, letterSpacing: 1 }}>{it.rel}</div>
            <div style={{ fontSize: 10, color: P.muted, marginTop: 2 }}>{it.period}</div>
            <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 16, color: P.white, marginTop: 6, marginBottom: 10, lineHeight: 1.15 }}>{it.label}</div>
            {it.bullets.map((b, j) => (
              <div key={j} style={{ fontSize: 11, color: P.dim, lineHeight: 1.5, display: "flex", gap: 6, marginBottom: 3 }}>
                <span style={{ color: it.color, fontSize: 7, marginTop: 6 }}>◆</span>{b}
              </div>
            ))}
          </div>
        </Reveal>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Small presentational helpers for section headers (read text from COPY)
// ═════════════════════════════════════════════════════════════════════════
function Kicker({ children, color, align = "center", mb = 14 }) {
  return (
    <div style={{ fontFamily: FF_MONO, fontSize: 12, color, letterSpacing: 4, marginBottom: mb, textTransform: "uppercase", textAlign: align }}>
      {children}
    </div>
  );
}
function Heading({ parts, size = "clamp(26px, 5vw, 52px)", mb = 12, lineHeight = 1.1 }) {
  return (
    <h2 style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: size, textAlign: "center", margin: `0 0 ${mb}px`, letterSpacing: -1, lineHeight }}>
      <Rich parts={parts} />
    </h2>
  );
}
function Lede({ children, size = 14, mb = 28, max = 780 }) {
  return (
    <div style={{ textAlign: "center", color: P.dim, fontSize: size, marginBottom: mb, maxWidth: max, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════
export default function NorthStarFutureVision() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const ref = useRef(null);

  const onScroll = useCallback(() => {
    const el = ref.current; if (!el) return;
    setProgress(el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight));
    const cur = Math.round(el.scrollTop / el.clientHeight);
    if (cur !== active) setActive(cur);
  }, [active]);

  const scrollTo = (i) => ref.current?.scrollTo({ top: i * ref.current.clientHeight, behavior: "smooth" });

  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const S = {
    height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
    position: "relative", padding: "40px 60px", scrollSnapAlign: "start", boxSizing: "border-box",
  };

  return (
    <div style={{ width: "100%", height: "100vh", background: P.deep, fontFamily: FF_BODY, color: P.white, overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse  { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
        @keyframes drift  { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes spin   { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        * { scrollbar-width: none; } *::-webkit-scrollbar { display: none; }
      `}</style>

      <NeuralNebula active={active} />

      {/* Progress bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, height: 3, zIndex: 100, width: `${progress * 100}%`,
        background: `linear-gradient(90deg, ${P.purple}, ${P.magenta}, ${P.cyan}, ${P.gold})`,
        transition: "width 0.1s", boxShadow: `0 0 16px ${P.purple}88`,
      }} />

      {/* Nav dots */}
      <div style={{ position: "fixed", right: 22, top: "50%", transform: "translateY(-50%)", zIndex: 100, display: "flex", flexDirection: "column", gap: 10 }}>
        {SECTIONS.map((id, i) => (
          <div key={id} onClick={() => scrollTo(i)} title={COPY.navLabels[i] || "Start"} style={{
            width: active === i ? 12 : 7, height: active === i ? 12 : 7, borderRadius: "50%",
            background: active === i ? P.light : "rgba(244,224,255,0.18)",
            cursor: "pointer", transition: "all 0.3s", boxShadow: active === i ? `0 0 14px ${P.light}aa` : "none",
          }} />
        ))}
      </div>

      {/* Back link */}
      <a href="index.html" style={{
        position: "fixed", top: 18, right: 24, zIndex: 110, fontFamily: FF_BODY, fontSize: 12, color: P.light,
        textDecoration: "none", letterSpacing: 1, opacity: 0.65, padding: "6px 12px", borderRadius: 999, border: `1px solid ${P.faint}`,
      }}>{COPY.ui.backLink}</a>

      {/* Top-left logos */}
      <div style={{ position: "fixed", top: 16, left: 24, zIndex: 100, display: "flex", alignItems: "center", gap: 14, opacity: 0.7 }}>
        <img src={new URL("../assets/images/Telia_Logotype_RGB_Purple.png", import.meta.url)} alt="Telia" style={{ height: 36, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>×</span>
        <img src={new URL("../assets/images/Eric.png", import.meta.url)} alt="Ericsson" style={{ height: 36, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
      </div>

      <div ref={ref} style={{ height: "100vh", overflowY: "auto", scrollSnapType: "y mandatory", position: "relative", zIndex: 1 }}>

        {/* ════════════ 0. HERO ════════════ */}
        <div style={S}>
          <div style={{ textAlign: "center", maxWidth: 1100 }}>
            <Reveal active={active === 0}>
              <div style={{ fontFamily: FF_MONO, fontSize: 12, color: P.cyan, letterSpacing: 6, textTransform: "uppercase", marginBottom: 26 }}>
                {COPY.hero.kicker}
              </div>
            </Reveal>
            <Reveal active={active === 0} delay={0.1}>
              <h1 style={{
                fontSize: "clamp(56px, 10vw, 140px)", fontWeight: 300, fontFamily: FF_HEAD, margin: 0, lineHeight: 0.92, letterSpacing: -3,
                background: `linear-gradient(135deg, ${P.white} 0%, ${P.light} 35%, ${P.cyan} 65%, ${P.magenta} 100%)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundSize: "200% 200%", animation: "shimmer 8s ease-in-out infinite",
              }}>{COPY.hero.title}</h1>
            </Reveal>
            <Reveal active={active === 0} delay={0.25}>
              <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: "clamp(20px, 2.8vw, 32px)", color: P.white, marginTop: 18, lineHeight: 1.3 }}>
                <Rich parts={COPY.hero.subtitle} />
              </div>
            </Reveal>
            <Reveal active={active === 0} delay={0.45}>
              <div style={{ display: "flex", justifyContent: "center", gap: 56, marginTop: 60, flexWrap: "wrap" }}>
                {COPY.hero.stats.map((s, i) => (
                  <Reveal key={i} active={active === 0} delay={0.5 + i * 0.12}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 44, color: P.light, letterSpacing: -1 }}>
                        <Counter to={s.v} prefix={s.pre} suffix={s.suf} active={active === 0} decimals={s.dec} />
                      </div>
                      <div style={{ fontSize: 11, color: P.muted, marginTop: 6, letterSpacing: 1, maxWidth: 140 }}>{s.label}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </Reveal>
            <div style={{ marginTop: 60, animation: "pulse 2s infinite", color: P.muted, fontSize: 12, letterSpacing: 2 }}>
              {COPY.ui.scrollHint}
            </div>
          </div>
        </div>

        {/* ════════════ 1. THE INFLECTION POINT ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1080, width: "100%" }}>
            <Reveal active={active === 1}><Kicker color={P.gold}>{COPY.inflection.kicker}</Kicker></Reveal>
            <Reveal active={active === 1} delay={0.1}>
              <Heading parts={COPY.inflection.headline} size="clamp(28px, 5vw, 56px)" mb={0} />
            </Reveal>

            <div style={{ marginTop: 50, position: "relative" }}>
              <div style={{
                position: "absolute", left: "5%", right: "5%", top: 42, height: 3,
                background: `linear-gradient(90deg, ${P.faint}, ${P.purple} 40%, ${P.cyan} 55%, ${P.gold} 80%, ${P.green})`,
                borderRadius: 2, boxShadow: `0 0 14px ${P.cyan}55`,
              }} />
              <div style={{
                position: "absolute", left: "calc(5% + (90% * 0.42))", top: 30, width: 28, height: 28, borderRadius: "50%",
                background: P.gold, boxShadow: `0 0 22px ${P.gold}, 0 0 50px ${P.gold}88`, animation: "pulse 1.8s ease-in-out infinite",
                transform: "translateX(-50%)", opacity: active === 1 ? 1 : 0, transition: "opacity 0.6s ease 0.4s",
              }} />
              <div style={{
                position: "absolute", left: "calc(5% + (90% * 0.42))", top: 0, transform: "translateX(-50%)",
                fontFamily: FF_MONO, fontSize: 11, color: P.gold, letterSpacing: 2,
                opacity: active === 1 ? 1 : 0, transition: "opacity 0.6s ease 0.5s", textTransform: "uppercase",
              }}>{COPY.inflection.youAreHere}</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, marginTop: 90 }}>
                {COPY.inflection.eras.map((p, i) => (
                  <Reveal key={p.era} active={active === 1} delay={0.2 + i * 0.08}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: FF_MONO, fontSize: 12, fontWeight: 700, color: p.c, letterSpacing: 1 }}>{p.era}</div>
                      <div style={{ fontFamily: FF_MONO, fontSize: 10, color: P.muted, marginTop: 2 }}>{p.y}</div>
                      <div style={{ fontSize: 11, color: P.dim, marginTop: 6 }}>{p.t}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            <Reveal active={active === 1} delay={0.6}>
              <div style={{
                marginTop: 50, background: `linear-gradient(135deg, ${P.purple}0e, ${P.cyan}0e)`,
                border: `1px solid ${P.purple}30`, borderRadius: 18, padding: "28px 32px",
                fontSize: 15, color: "rgba(244,224,255,0.85)", lineHeight: 1.65, textAlign: "center",
              }}>
                <Rich parts={COPY.inflection.note} />
              </div>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 2. THREE WAVES ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 2}><Kicker color={P.cyan}>{COPY.waves.kicker}</Kicker></Reveal>
            <Reveal active={active === 2} delay={0.08}><Heading parts={COPY.waves.headline} size="clamp(28px, 5vw, 52px)" mb={36} /></Reveal>
            <WaveBands active={active === 2} />
          </div>
        </div>

        {/* ════════════ 3. INSIDE THE CORE — iframe ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1280, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <Reveal active={active === 3}><Kicker color={P.purple} mb={8}>{COPY.core.kicker}</Kicker></Reveal>
            <Reveal active={active === 3} delay={0.08}><Heading parts={COPY.core.headline} size="clamp(24px, 4vw, 42px)" mb={14} /></Reveal>
            <Reveal active={active === 3} delay={0.16}><Lede size={13} mb={16} max={760}>{COPY.core.body}</Lede></Reveal>
            <Reveal active={active === 3} delay={0.24} style={{ flex: 1, minHeight: 0 }}>
              <div style={{
                width: "100%", height: "100%", minHeight: 480, borderRadius: 18, overflow: "hidden",
                border: `1px solid ${P.purple}33`, boxShadow: `0 20px 60px rgba(0,0,0,0.45), 0 0 24px ${P.purple}33`, background: P.dark,
              }}>
                <iframe src="5g-sa-architecture-diagram.html" title="5G SA architecture diagram" style={{ width: "100%", height: "100%", border: 0, display: "block" }} loading="lazy" />
              </div>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 4. LIVE SLICING — iframe ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1280, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <Reveal active={active === 4}><Kicker color={P.cyan} mb={8}>{COPY.slicing.kicker}</Kicker></Reveal>
            <Reveal active={active === 4} delay={0.08}><Heading parts={COPY.slicing.headline} size="clamp(24px, 4vw, 42px)" mb={14} /></Reveal>
            <Reveal active={active === 4} delay={0.16}><Lede size={13} mb={16} max={820}>{COPY.slicing.body}</Lede></Reveal>
            <Reveal active={active === 4} delay={0.24} style={{ flex: 1, minHeight: 0 }}>
              <div style={{
                width: "100%", height: "100%", minHeight: 480, borderRadius: 18, overflow: "hidden",
                border: `1px solid ${P.cyan}33`, boxShadow: `0 20px 60px rgba(0,0,0,0.45), 0 0 24px ${P.cyan}33`, background: P.dark,
              }}>
                <iframe src="unified-5g-viz.html" title="Unified 5G slicing and L4S visualization" style={{ width: "100%", height: "100%", border: 0, display: "block" }} loading="lazy" />
              </div>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 5. AI-NATIVE NETWORKS ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 5}><Kicker color={P.magenta}>{COPY.ainative.kicker}</Kicker></Reveal>
            <Reveal active={active === 5} delay={0.08}><Heading parts={COPY.ainative.headline} mb={8} /></Reveal>
            <Reveal active={active === 5} delay={0.16}><Lede mb={24}>{COPY.ainative.body}</Lede></Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "center" }}>
              <Reveal active={active === 5} delay={0.24}><ClosedLoopSVG active={active === 5} /></Reveal>
              <Reveal active={active === 5} delay={0.34}>
                <div>
                  {COPY.ainative.points.map((it, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ width: 6, borderRadius: 3, background: `linear-gradient(180deg, ${it.color}, transparent)` }} />
                        <div>
                          <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 18, color: P.white, marginBottom: 4 }}>{it.title}</div>
                          <div style={{ fontSize: 12.5, color: P.dim, lineHeight: 1.55 }}>{it.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* ════════════ 6. AMBIENT — ISAC ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 6}><Kicker color={P.gold}>{COPY.ambient.kicker}</Kicker></Reveal>
            <Reveal active={active === 6} delay={0.08}><Heading parts={COPY.ambient.headline} mb={12} /></Reveal>
            <Reveal active={active === 6} delay={0.16}><Lede mb={32} max={800}><Rich parts={COPY.ambient.body} /></Lede></Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "center" }}>
              <Reveal active={active === 6} delay={0.24}><ISACVisual active={active === 6} /></Reveal>
              <Reveal active={active === 6} delay={0.34}>
                <div>
                  {COPY.ambient.uses.map((u, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 22 }}>{u.icon}</div>
                      <div>
                        <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 16, color: P.white }}>{u.title}</div>
                        <div style={{ fontSize: 12, color: P.dim, lineHeight: 1.5 }}>{u.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* ════════════ 7. POSITIONING ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 7}><Kicker color={P.green}>{COPY.positioning.kicker}</Kicker></Reveal>
            <Reveal active={active === 7} delay={0.08}><Heading parts={COPY.positioning.headline} mb={12} /></Reveal>
            <Reveal active={active === 7} delay={0.16}><Lede mb={30} max={760}>{COPY.positioning.body}</Lede></Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
              {COPY.positioning.ladder.map((p, i) => (
                <Reveal key={p.era} active={active === 7} delay={0.22 + i * 0.1}>
                  <div style={{
                    background: `linear-gradient(180deg, ${p.color}10, transparent)`,
                    border: `1px solid ${p.color}33`, borderRadius: 16, padding: "18px 16px", textAlign: "center", height: 200, position: "relative",
                  }}>
                    <div style={{ fontFamily: FF_MONO, fontSize: 11, color: p.color, letterSpacing: 1, marginBottom: 14 }}>{p.era}</div>
                    <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 36, color: P.white, marginBottom: 8, letterSpacing: -1 }}>{p.acc}</div>
                    <div style={{ fontSize: 11, color: P.dim, lineHeight: 1.5 }}>{p.detail}</div>
                    <div style={{
                      position: "absolute", left: "50%", bottom: 12, transform: "translateX(-50%)",
                      width: i < 3 ? `${50 - i * 12}%` : "8%", height: 6, borderRadius: 3,
                      background: p.color, boxShadow: `0 0 12px ${p.color}aa`, opacity: 0.7,
                    }} />
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal active={active === 7} delay={0.65}>
              <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 12, color: P.dim }}>
                {COPY.positioning.examples.map((it, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${P.faint}`, borderRadius: 12, padding: "14px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 22 }}>{it.icon}</span>
                    <span style={{ lineHeight: 1.5 }}>{it.what}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 8. NTN ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 8}><Kicker color={P.cyan}>{COPY.ntn.kicker}</Kicker></Reveal>
            <Reveal active={active === 8} delay={0.08}><Heading parts={COPY.ntn.headline} mb={12} /></Reveal>
            <Reveal active={active === 8} delay={0.16}><Lede mb={30} max={760}>{COPY.ntn.body}</Lede></Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 32, alignItems: "center" }}>
              <Reveal active={active === 8} delay={0.24}><OrbitalView active={active === 8} /></Reveal>
              <Reveal active={active === 8} delay={0.34}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {COPY.ntn.items.map((it, i) => (
                    <div key={i} style={{ background: `linear-gradient(180deg, ${it.c}10, transparent)`, border: `1px solid ${it.c}30`, borderRadius: 14, padding: "16px 14px" }}>
                      <div style={{ fontFamily: FF_MONO, fontSize: 10, color: it.c, letterSpacing: 1, marginBottom: 6 }}>{it.y}</div>
                      <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 16, color: P.white, marginBottom: 6, lineHeight: 1.2 }}>{it.title}</div>
                      <div style={{ fontSize: 11, color: P.dim, lineHeight: 1.5 }}>{it.desc}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* ════════════ 9. VERTICAL TRANSFORMATIONS ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1140, width: "100%" }}>
            <Reveal active={active === 9}><Kicker color={P.magenta}>{COPY.verticals.kicker}</Kicker></Reveal>
            <Reveal active={active === 9} delay={0.08}><Heading parts={COPY.verticals.headline} size="clamp(26px, 5vw, 50px)" mb={10} /></Reveal>
            <Reveal active={active === 9} delay={0.16}><Lede size={13} mb={28} max={720}>{COPY.verticals.body}</Lede></Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "1fr", gap: 14 }}>
              {COPY.verticals.cards.map((c, i) => (
                <VerticalCard key={i} active={active === 9} delay={0.22 + i * 0.08}
                  icon={c.icon} year={c.year} title={c.title} color={c.color} body={c.body} tech={c.tech} />
              ))}
            </div>
          </div>
        </div>

        {/* ════════════ 10. ECONOMY ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 10}><Kicker color={P.gold}>{COPY.economy.kicker}</Kicker></Reveal>
            <Reveal active={active === 10} delay={0.08}><Heading parts={COPY.economy.headline} size="clamp(26px, 5vw, 50px)" mb={12} /></Reveal>
            <Reveal active={active === 10} delay={0.16}><Lede size={13} mb={24} max={760}>{COPY.economy.body}</Lede></Reveal>
            <Reveal active={active === 10} delay={0.24}><EconomyChart active={active === 10} /></Reveal>
            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {COPY.economy.stats.map((s, i) => (
                <Reveal key={i} active={active === 10} delay={0.4 + i * 0.08}>
                  <div style={{ border: `1px solid ${s.c}33`, borderRadius: 14, padding: "16px 14px", background: `linear-gradient(180deg, ${s.c}0e, transparent)`, textAlign: "center" }}>
                    <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 26, color: s.c, letterSpacing: -0.5 }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: P.dim, marginTop: 4, lineHeight: 1.4 }}>{s.l}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════ 11. ROADMAP ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1080, width: "100%" }}>
            <Reveal active={active === 11}><Kicker color={P.purple}>{COPY.roadmap.kicker}</Kicker></Reveal>
            <Reveal active={active === 11} delay={0.08}><Heading parts={COPY.roadmap.headline} size="clamp(26px, 5vw, 50px)" mb={22} /></Reveal>
            <RoadmapView active={active === 11} />
          </div>
        </div>

        {/* ════════════ 12. TOWARD 6G ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 12}><Kicker color={P.gold}>{COPY.sixg.kicker}</Kicker></Reveal>
            <Reveal active={active === 12} delay={0.08}><Heading parts={COPY.sixg.headline} size="clamp(26px, 5vw, 50px)" mb={12} /></Reveal>
            <Reveal active={active === 12} delay={0.16}><Lede size={13} mb={28} max={800}>{COPY.sixg.body}</Lede></Reveal>
            <SixGRoadmap active={active === 12} />

            <Reveal active={active === 12} delay={0.85}>
              <div style={{
                marginTop: 24, padding: "16px 24px", background: `linear-gradient(135deg, ${P.gold}10, ${P.purple}10)`,
                border: `1px solid ${P.gold}33`, borderRadius: 12, fontSize: 12, color: "rgba(244,224,255,0.78)", lineHeight: 1.65, textAlign: "center",
              }}>
                <strong style={{ color: P.gold, fontFamily: FF_MONO, fontSize: 11, letterSpacing: 1 }}>{COPY.sixg.note.label}</strong>
                {COPY.sixg.note.text}
              </div>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 13. VISION / CTA ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1000, textAlign: "center" }}>
            <Reveal active={active === 13}>
              <div style={{ fontFamily: FF_MONO, fontSize: 12, color: P.cyan, letterSpacing: 6, textTransform: "uppercase", marginBottom: 28 }}>{COPY.vision.kicker}</div>
            </Reveal>
            <Reveal active={active === 13} delay={0.1}>
              <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: "clamp(36px, 6.5vw, 76px)", lineHeight: 1.05, letterSpacing: -2 }}>
                <Rich parts={COPY.vision.headline} />
              </div>
            </Reveal>
            <Reveal active={active === 13} delay={0.3}>
              <p style={{ fontSize: 17, color: P.dim, marginTop: 32, lineHeight: 1.7, maxWidth: 720, margin: "32px auto 0" }}>
                {COPY.vision.body}
              </p>
            </Reveal>
            <Reveal active={active === 13} delay={0.5}>
              <div style={{ marginTop: 44, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
                {COPY.vision.ctas.map((c, i) => (
                  <a key={i} href={c.href} style={c.primary ? ctaPrimary : ctaGhost}>{c.label}</a>
                ))}
              </div>
            </Reveal>
            <div style={{ marginTop: 60, fontFamily: FF_MONO, fontSize: 10, color: P.faint, letterSpacing: 3 }}>
              {COPY.ui.footer}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

const ctaPrimary = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px",
  background: `linear-gradient(135deg, ${P.purple}, ${P.magenta})`,
  color: P.white, borderRadius: 999, textDecoration: "none", fontWeight: 500, fontSize: 14,
  border: 0, transition: "transform 0.2s, box-shadow 0.2s, background 0.2s",
  boxShadow: `0 8px 22px ${P.purple}55`,
};
const ctaGhost = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px",
  background: "transparent", color: P.light, border: `1px solid ${P.light}55`,
  borderRadius: 999, textDecoration: "none", fontWeight: 500, fontSize: 14,
  transition: "background 0.2s, color 0.2s, border-color 0.2s",
};
