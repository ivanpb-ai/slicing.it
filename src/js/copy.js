import { P } from "./palette";

// =====================================================================
//  ALL EDITABLE TEXT LIVES HERE - edit the words inside the quotes.
//  Colours are P.<name> (see palette.js).
//  Prefer a UI? Open /copy-editor.html to edit text + colours and
//  export an updated version of this file.
// =====================================================================
export const COPY = {
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
      "Three waves:", { br: true }, { t: "Programmable", c: P.cyan }, " · ",
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
          "Analytics-driven closed-loop assurance — proactive SLA management",
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
          "Ambient IoT — billions of battery-less devices via backscatter",
          "Post-quantum security & sovereign-grade slicing as default",
        ],
      },
    ],
  },

  // 3 — INSIDE THE CORE (iframe)
  core: {
    kicker: "Architecture · Preview",
    headline: ["Inside the ", { t: "5G SA Core", c: P.gold }],
    body: "Slices, RRPs, 5QIs, DNNs — the programmable fabric beneath every future use case. Explore the relationships that turn one network into many purpose-built ones.",
  },

  // 4 — LIVE SLICING (iframe)
  slicing: {
    kicker: "Live Simulation",
    headline: ["Radio spectrum ", { t: "used wisely", c: P.cyan }],
    body: "Radio resource partitions borrow unused spectrum from one another within policy min/max bounds. When a slice goes idle its floor returns to the shared pool so another can burst toward its ceiling — and the instant demand returns, the scheduler hands the capacity straight back.",
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
    note: [
      { t: "NWDAF", c: P.magenta, b: true },
      " is the 3GPP-defined Network Data Analytics Function for 5G Core, responsible for collecting network data and producing analytics that other network functions can use for AI-based analytics, automation and optimization.",
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
      { era: "5G SA · 2026–2027", acc: "~1–2 m",  detail: "Indoor — dot positioning · RTK over 5G SA", color: P.cyan },
      { era: "5G SA · 2026–2027", acc: "~5–10 m", detail: "Outdoor — Timing Advance + Angle-of-Arrival · GPS-level alternative / fallback", color: P.cyan },
      { era: "2028–2030",         acc: "<50 cm",  detail: "AI fusion · ISAC · macro",  color: P.magenta },
      { era: "2030+",             acc: "<10 cm",  detail: "Cross-tech · 6G upper mid",  color: P.green },
    ],
    examplesTitle: "Use cases — across every era",
    examples: [
      { icon: "⛏️", what: "Underground tracking of workers and machines far below the surface." },
      { icon: "🩺", what: "Locate medical assets in hospitals to the room — without GPS." },
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
    headline: ["Where Sweden builds the ", { t: "future, first", c: P.cyan }],
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
