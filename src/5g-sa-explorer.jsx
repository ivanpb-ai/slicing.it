import { useState, useEffect, useRef, useCallback } from "react";

const P = {
  bg: "#060B18", surface: "#0C1629", card: "#111D35", border: "rgba(0,180,255,0.15)",
  blue: "#0094FF", cyan: "#00D4FF", light: "#7DD3FC", accent: "#38BDF8",
  purple: "#990AE3", magenta: "#E040FB", white: "#FFFFFF",
  dim: "rgba(255,255,255,0.55)", muted: "rgba(255,255,255,0.25)",
  gold: "#FFD740", green: "#69F0AE", red: "#FF5252",
};

const SECTIONS = [
  { id: "hero", label: "" },
  { id: "gap", label: "The Leap" },
  { id: "architecture", label: "Architecture" },
  { id: "slicing", label: "Network Slicing" },
  { id: "usecases", label: "Use Cases" },
  { id: "comparison", label: "4G vs 5G SA" },
  { id: "evolution", label: "Evolution" },
  { id: "future", label: "The Future" },
];

function NavDots({ active, onNav }) {
  return (
    <div style={{ position: "fixed", right: 20, top: "50%", transform: "translateY(-50%)", zIndex: 100, display: "flex", flexDirection: "column", gap: 10 }}>
      {SECTIONS.map((s, i) => (
        <div key={s.id} onClick={() => onNav(i)} title={s.label}
          style={{ width: active === i ? 12 : 7, height: active === i ? 12 : 7, borderRadius: "50%", background: active === i ? P.cyan : "rgba(255,255,255,0.15)", cursor: "pointer", transition: "all 0.3s", boxShadow: active === i ? `0 0 12px ${P.cyan}88` : "none" }} />
      ))}
    </div>
  );
}

function CompBar({ label, val4g, val5g, active, delay = 0, color5g = P.cyan }) {
  return (
    <div style={{ marginBottom: 16, opacity: active ? 1 : 0, transform: active ? "translateX(0)" : "translateX(-20px)", transition: `all 0.5s ease ${delay}s` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 0.5 }}>
        <span style={{ color: P.white }}>{label}</span>
        <span style={{ color: P.muted }}><span style={{ color: "#888" }}>4G</span> vs <span style={{ color: color5g }}>5G SA</span></span>
      </div>
      <div style={{ position: "relative", height: 20, background: "rgba(255,255,255,0.03)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: active ? `${val4g}%` : "0%", background: "rgba(255,255,255,0.08)", borderRadius: 10, transition: `width 1s ease ${0.3 + delay}s` }} />
        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: active ? `${val5g}%` : "0%", background: `linear-gradient(90deg, ${P.blue}, ${color5g})`, borderRadius: 10, transition: `width 1.2s cubic-bezier(0.16,1,0.3,1) ${0.3 + delay}s`, boxShadow: `0 0 12px ${P.blue}44` }} />
      </div>
    </div>
  );
}

function SliceCard({ title, icon, qos, latency, bandwidth, color, desc, active, delay }) {
  return (
    <div style={{
      background: `${color}08`, border: `1px solid ${color}30`, borderRadius: 16, padding: "22px 20px",
      opacity: active ? 1 : 0, transform: active ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
      transition: `all 0.5s ease ${delay}s`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: P.white }}>{title}</div>
          <div style={{ fontSize: 10, color: color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{qos}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: P.dim, lineHeight: 1.6, marginBottom: 12 }}>{desc}</div>
      <div style={{ display: "flex", gap: 16, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
        <span style={{ color: P.muted }}>Latency: <span style={{ color }}>{latency}</span></span>
        <span style={{ color: P.muted }}>BW: <span style={{ color }}>{bandwidth}</span></span>
      </div>
    </div>
  );
}

function EvoTimeline({ active }) {
  const items = [
    { year: "Rel-15/16", period: "2018–2020", label: "5G Foundation", color: P.blue, items: ["5G NR air interface", "eMBB, URLLC, mMTC defined", "NSA & SA architectures", "First network slicing specs", "V2X & Industrial IoT support"] },
    { year: "Rel-17", period: "2021–2022", label: "5G Expansion", color: P.cyan, items: ["Non-Terrestrial Networks (NTN)", "RedCap (NR-Light) for IoT", "Enhanced positioning (<1m indoor)", "Sidelink for D2D communication", "Multi-SIM & small data optimization"] },
    { year: "Rel-18", period: "2023–2024", label: "5G-Advanced", color: P.green, items: ["AI/ML for RAN optimization", "XR (AR/VR) support", "Enhanced MIMO & duplex", "Multicast-Broadcast Services", "Network energy saving"] },
    { year: "Rel-19", period: "2025–2026", label: "5G-Advanced Phase 2", color: P.gold, items: ["AI/ML on air interface", "Sub-band full duplex (SBFD)", "ISAC channel modeling", "Ambient IoT (ultra-low power)", "FR3 spectrum (7-24 GHz) studies"] },
    { year: "Rel-20/21", period: "2027–2030", label: "Bridge to 6G", color: P.magenta, items: ["First 6G study items", "6G RAN specification (Rel-21)", "Sub-THz frequencies", "Integrated sensing & communication", "AI-native network architecture"] },
  ];

  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 4 }}>
        {items.map((it, i) => (
          <div key={it.year} onClick={() => setExpanded(expanded === i ? null : i)}
            style={{ flex: 1, cursor: "pointer", opacity: active ? 1 : 0, transform: active ? "translateY(0)" : `translateY(${30 + i * 10}px)`, transition: `all 0.5s ease ${i * 0.1}s` }}>
            <div style={{ height: 6, background: it.color, borderRadius: 3, marginBottom: 10, boxShadow: expanded === i ? `0 0 20px ${it.color}88` : `0 0 8px ${it.color}44` }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: expanded === i ? it.color : P.white }}>{it.year}</div>
              <div style={{ fontSize: 10, color: P.muted, marginTop: 2 }}>{it.period}</div>
              <div style={{ fontSize: 11, color: expanded === i ? it.color : P.dim, marginTop: 4, fontWeight: 600 }}>{it.label}</div>
            </div>
          </div>
        ))}
      </div>
      {expanded !== null && (
        <div style={{ marginTop: 28, background: `${items[expanded].color}10`, border: `1px solid ${items[expanded].color}30`, borderRadius: 16, padding: "24px 28px", animation: "fadeUp 0.3s ease" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: items[expanded].color, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>
            {items[expanded].label} — {items[expanded].period}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
            {items[expanded].items.map((item, j) => (
              <div key={j} style={{ display: "flex", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
                <span style={{ color: items[expanded].color, fontSize: 7, marginTop: 6, flexShrink: 0 }}>◆</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
      {expanded === null && <div style={{ textAlign: "center", color: P.muted, fontSize: 13, marginTop: 24, fontStyle: "italic" }}>Click a release to explore</div>}
    </div>
  );
}

export default function FiveGSAExplorer() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const ref = useRef(null);

  const handleScroll = useCallback(() => {
    if (!ref.current) return;
    const el = ref.current;
    setProgress(el.scrollTop / (el.scrollHeight - el.clientHeight));
    const cur = Math.round(el.scrollTop / el.clientHeight);
    if (cur !== active) setActive(cur);
  }, [active]);

  const scrollTo = (i) => ref.current?.scrollTo({ top: i * ref.current.clientHeight, behavior: "smooth" });

  useEffect(() => {
    const el = ref.current;
    el?.addEventListener("scroll", handleScroll);
    return () => el?.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const S = { height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative", padding: "40px 60px", scrollSnapAlign: "start", boxSizing: "border-box" };

  return (
    <div style={{ width: "100%", height: "100vh", background: P.bg, fontFamily: "'Segoe UI', system-ui, sans-serif", color: P.white, overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Outfit:wght@400;600;700;800&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
        * { scrollbar-width:none; } *::-webkit-scrollbar { display:none; }
      `}</style>

      <div style={{ position: "fixed", top: 0, left: 0, height: 3, width: `${progress * 100}%`, background: `linear-gradient(90deg, ${P.blue}, ${P.cyan}, ${P.green})`, zIndex: 100 }} />
      <NavDots active={active} onNav={scrollTo} />

      {/* Logos */}
      <div style={{ position: "fixed", top: 14, left: 24, zIndex: 100, display: "flex", alignItems: "center", gap: 12, opacity: 0.6 }}>
        <img src={`data:image/png;base64,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`} alt="Telia" style={{ height: 28 }} />
</div>

      <div ref={ref} style={{ height: "100vh", overflowY: "auto", scrollSnapType: "y mandatory", position: "relative", zIndex: 1 }}>

        {/* HERO */}
        <div style={S}>
          <div style={{ textAlign: "center", maxWidth: 850, animation: "fadeUp 1s ease" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: P.cyan, letterSpacing: 5, marginBottom: 24, textTransform: "uppercase" }}>Understanding the technology</div>
            <h1 style={{ fontSize: "clamp(44px, 8vw, 90px)", fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0, lineHeight: 0.95, background: `linear-gradient(135deg, ${P.white} 0%, ${P.cyan} 50%, ${P.blue} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -2 }}>5G Standalone</h1>
            <p style={{ fontSize: 20, color: P.dim, marginTop: 24, lineHeight: 1.6 }}>The end-to-end 5G network that transforms connectivity<br /><span style={{ fontSize: 15, color: P.muted }}>from one-size-fits-all to purpose-built for every use case</span></p>
            <div style={{ display: "flex", justifyContent: "center", gap: 36, marginTop: 48 }}>
              {[{ v: "1ms", l: "Latency" }, { v: "20", l: "Gbps Peak" }, { v: "1M", l: "Devices/km²" }, { v: "99.999%", l: "Reliability" }].map((item, i) => (
                <div key={i} style={{ textAlign: "center", animation: "fadeUp 1s ease", animationDelay: `${0.3 + i * 0.12}s`, animationFillMode: "both" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: P.cyan }}>{item.v}</div>
                  <div style={{ fontSize: 11, color: P.muted, marginTop: 4, letterSpacing: 1 }}>{item.l}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 56, animation: "pulse 2s infinite", color: P.muted, fontSize: 13 }}>Scroll to explore ↓</div>
          </div>
        </div>

        {/* THE LEAP */}
        <div style={S}>
          <div style={{ maxWidth: 820, textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: P.gold, letterSpacing: 4, marginBottom: 16, textTransform: "uppercase", opacity: active === 1 ? 1 : 0, transition: "opacity 0.5s" }}>The Quantum Leap</div>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 42px)", fontWeight: 700, fontFamily: "'Outfit', sans-serif", margin: 0, lineHeight: 1.25, opacity: active === 1 ? 1 : 0, transform: active === 1 ? "translateY(0)" : "translateY(25px)", transition: "all 0.6s ease" }}>
              4G gave us <span style={{ color: P.gold }}>fast pipes</span>.<br />5G NSA gave us <span style={{ color: "#FF8A65" }}>faster pipes</span>.<br />5G SA gives us <span style={{ color: P.cyan }}>programmable networks</span>.
            </h2>
            <p style={{ fontSize: 15, color: P.dim, marginTop: 20, lineHeight: 1.7, opacity: active === 1 ? 1 : 0, transition: "opacity 0.6s ease 0.3s" }}>
              4G LTE was a single highway — everyone shares the same road, same rules, same speed limits.
              When 5G launched, most operators deployed <strong style={{ color: "#FF8A65" }}>5G Non-Standalone (NSA)</strong> — bolting
              a 5G radio layer onto the existing 4G core. This delivered faster speeds, but the 4G core remained the brain,
              meaning no network slicing, no ultra-low latency, and no true 5G capabilities.
              <strong style={{ color: P.cyan }}> 5G Standalone</strong> replaces the entire core with a cloud-native 5G architecture —
              transforming the network from a dumb pipe into a programmable platform.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginTop: 32 }}>
              {[
                { icon: "📶", title: "5G NSA: The Halfway Step", desc: "5G radio + 4G core. Faster downloads, but the legacy core blocks slicing, edge compute, and sub-ms latency. Not 'real' 5G.", color: "#FF8A65" },
                { icon: "🧠", title: "Cloud-Native Core", desc: "5G SA replaces the monolithic 4G core with microservices that scale elastically — the foundation NSA lacks.", color: P.cyan },
                { icon: "🔀", title: "Network Slicing", desc: "Impossible on NSA. Only 5G SA's dedicated core can create isolated virtual networks with guaranteed SLAs.", color: P.green },
                { icon: "⚡", title: "True Low Latency", desc: "NSA still routes control signals through 4G, adding 20-30ms. 5G SA eliminates this with a native 5G control plane.", color: P.gold },
              ].map((item, i) => (
                <div key={i} style={{ background: `${item.color}08`, border: `1px solid ${item.color}18`, borderRadius: 16, padding: "22px 16px", opacity: active === 1 ? 1 : 0, transform: active === 1 ? "translateY(0)" : "translateY(20px)", transition: `all 0.5s ease ${0.3 + i * 0.1}s` }}>
                  <div style={{ fontSize: 26, marginBottom: 10 }}>{item.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: item.color }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: P.dim, lineHeight: 1.55 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ARCHITECTURE */}
        <div style={S}>
          <div style={{ maxWidth: 860 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: P.blue, letterSpacing: 4, marginBottom: 16, textTransform: "uppercase", textAlign: "center", opacity: active === 2 ? 1 : 0, transition: "opacity 0.5s" }}>End-to-End Architecture</div>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 700, fontFamily: "'Outfit', sans-serif", textAlign: "center", margin: "0 0 32px", opacity: active === 2 ? 1 : 0, transform: active === 2 ? "translateY(0)" : "translateY(20px)", transition: "all 0.5s ease" }}>
              Three pillars of <span style={{ color: P.cyan }}>5G SA</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                { title: "5G New Radio (NR)", subtitle: "The Air Interface", color: P.cyan, items: ["Sub-6 GHz & mmWave spectrum", "Massive MIMO (64T64R+)", "Beamforming & beam tracking", "Flexible numerology (15-240 kHz)", "Carrier aggregation up to 1 GHz"] },
                { title: "5G Core (5GC)", subtitle: "The Brain", color: P.blue, items: ["Service-Based Architecture (SBA)", "Cloud-native microservices", "Control/user plane separation (CUPS)", "Network function virtualization", "Standardized APIs (NEF, NWDAF)"] },
                { title: "Edge & Transport", subtitle: "The Fabric", color: P.green, items: ["Multi-access edge computing (MEC)", "Local breakout / UPF placement", "Network slicing across all layers", "TSN integration for determinism", "AI/ML-driven orchestration"] },
              ].map((pillar, i) => (
                <div key={i} style={{ background: `${pillar.color}08`, border: `1px solid ${pillar.color}22`, borderRadius: 16, padding: "24px 20px", opacity: active === 2 ? 1 : 0, transform: active === 2 ? "translateY(0)" : "translateY(20px)", transition: `all 0.5s ease ${0.2 + i * 0.12}s` }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: pillar.color, marginBottom: 14, boxShadow: `0 0 12px ${pillar.color}88` }} />
                  <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{pillar.title}</div>
                  <div style={{ fontSize: 11, color: pillar.color, fontFamily: "'JetBrains Mono', monospace", marginBottom: 14, letterSpacing: 1 }}>{pillar.subtitle}</div>
                  {pillar.items.map((item, j) => (
                    <div key={j} style={{ display: "flex", gap: 8, fontSize: 13, color: P.dim, lineHeight: 1.6, marginBottom: 2 }}>
                      <span style={{ color: pillar.color, fontSize: 7, marginTop: 6, flexShrink: 0 }}>●</span>{item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* NETWORK SLICING */}
        <div style={S}>
          <div style={{ maxWidth: 880 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: P.green, letterSpacing: 4, marginBottom: 16, textTransform: "uppercase", textAlign: "center", opacity: active === 3 ? 1 : 0, transition: "opacity 0.5s" }}>Differentiated Connectivity</div>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 700, fontFamily: "'Outfit', sans-serif", textAlign: "center", margin: "0 0 12px", opacity: active === 3 ? 1 : 0, transform: active === 3 ? "translateY(0)" : "translateY(20px)", transition: "all 0.5s ease" }}>
              One network. <span style={{ color: P.green }}>Infinite purposes.</span>
            </h2>
            <p style={{ textAlign: "center", fontSize: 14, color: P.dim, marginBottom: 28, opacity: active === 3 ? 1 : 0, transition: "opacity 0.5s ease 0.2s" }}>
              Network slicing creates isolated virtual networks — each with its own SLA, security, and performance profile
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <SliceCard active={active === 3} delay={0.2} title="Enhanced Mobile Broadband" icon="📱" qos="eMBB" latency="~10ms" bandwidth="Up to 20 Gbps" color={P.cyan} desc="High-throughput connectivity for streaming, AR/VR, cloud gaming, and mobile broadband — the consumer slice." />
              <SliceCard active={active === 3} delay={0.3} title="Ultra-Reliable Low Latency" icon="🏭" qos="URLLC" latency="<1ms" bandwidth="Guaranteed" color={P.red} desc="Mission-critical communications for factory automation, remote surgery, autonomous vehicles, and real-time control." />
              <SliceCard active={active === 3} delay={0.4} title="Massive Machine-Type" icon="🌐" qos="mMTC" latency="Relaxed" bandwidth="Low per device" color={P.green} desc="1 million devices per km² — smart cities, agriculture sensors, environmental monitoring, and massive IoT deployments." />
              <SliceCard active={active === 3} delay={0.5} title="Public Safety & Defense" icon="🛡️" qos="Mission-Critical" latency="<5ms" bandwidth="Prioritized" color={P.gold} desc="Pre-emptive priority for first responders, military comms, and emergency services — always-on, never degraded." />
            </div>
          </div>
        </div>

        {/* USE CASES */}
        <div style={S}>
          <div style={{ maxWidth: 860 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: P.magenta, letterSpacing: 4, marginBottom: 16, textTransform: "uppercase", textAlign: "center", opacity: active === 4 ? 1 : 0, transition: "opacity 0.5s" }}>Real-World Impact</div>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 700, fontFamily: "'Outfit', sans-serif", textAlign: "center", margin: "0 0 28px", opacity: active === 4 ? 1 : 0, transform: active === 4 ? "translateY(0)" : "translateY(20px)", transition: "all 0.5s ease" }}>
              What becomes <span style={{ color: P.magenta }}>possible</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              {[
                { icon: "🚗", title: "Autonomous Vehicles", desc: "V2X communication with <1ms latency enables real-time coordination between vehicles, infrastructure, and pedestrians.", why: "URLLC + Edge" },
                { icon: "⛏️", title: "Smart Mining", desc: "Remote-controlled machinery 750m underground with positioning accuracy of 1-2 meters and guaranteed connectivity.", why: "URLLC + Positioning" },
                { icon: "🏥", title: "Remote Surgery", desc: "Haptic feedback over 5G SA enables surgeons to operate robotic instruments with zero perceptible delay.", why: "URLLC + Slicing" },
                { icon: "🏭", title: "Industry 4.0", desc: "Deterministic networking (TSN over 5G) for factory automation with microsecond timing precision.", why: "URLLC + TSN" },
                { icon: "🎮", title: "Cloud Gaming & XR", desc: "Immersive AR/VR with edge-rendered graphics streamed at 120fps — no local GPU needed.", why: "eMBB + Edge" },
                { icon: "🛰️", title: "Satellite + Terrestrial", desc: "NTN integration provides seamless coverage from deep mines to open oceans — no dead zones.", why: "NTN + mMTC" },
              ].map((uc, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: "20px 16px", opacity: active === 4 ? 1 : 0, transform: active === 4 ? "translateY(0)" : "translateY(16px)", transition: `all 0.5s ease ${0.15 + i * 0.08}s` }}>
                  <div style={{ fontSize: 26, marginBottom: 10 }}>{uc.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{uc.title}</div>
                  <div style={{ fontSize: 12, color: P.dim, lineHeight: 1.55, marginBottom: 10 }}>{uc.desc}</div>
                  <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: P.cyan, letterSpacing: 1 }}>{uc.why}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COMPARISON */}
        <div style={S}>
          <div style={{ maxWidth: 750, width: "100%" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: P.accent, letterSpacing: 4, marginBottom: 16, textTransform: "uppercase", textAlign: "center", opacity: active === 5 ? 1 : 0, transition: "opacity 0.5s" }}>Head to Head</div>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 700, fontFamily: "'Outfit', sans-serif", textAlign: "center", margin: "0 0 32px", opacity: active === 5 ? 1 : 0, transform: active === 5 ? "translateY(0)" : "translateY(20px)", transition: "all 0.5s ease" }}>
              4G LTE vs <span style={{ color: P.cyan }}>5G Standalone</span>
            </h2>
            <CompBar active={active === 5} delay={0} label="Peak Throughput" val4g={5} val5g={95} />
            <CompBar active={active === 5} delay={0.06} label="Latency (lower = better)" val4g={70} val5g={5} color5g={P.green} />
            <CompBar active={active === 5} delay={0.12} label="Device Density" val4g={10} val5g={90} />
            <CompBar active={active === 5} delay={0.18} label="Network Slicing" val4g={5} val5g={95} />
            <CompBar active={active === 5} delay={0.24} label="Edge Computing" val4g={10} val5g={85} />
            <CompBar active={active === 5} delay={0.30} label="Positioning Accuracy" val4g={15} val5g={90} color5g={P.gold} />
            <CompBar active={active === 5} delay={0.36} label="Reliability (Five 9s)" val4g={20} val5g={95} color5g={P.green} />
            <CompBar active={active === 5} delay={0.42} label="API Programmability" val4g={5} val5g={85} color5g={P.magenta} />
          </div>
        </div>

        {/* EVOLUTION */}
        <div style={S}>
          <div style={{ maxWidth: 950, width: "100%" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: P.green, letterSpacing: 4, marginBottom: 16, textTransform: "uppercase", textAlign: "center", opacity: active === 6 ? 1 : 0, transition: "opacity 0.5s" }}>Standards Evolution</div>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 700, fontFamily: "'Outfit', sans-serif", textAlign: "center", margin: "0 0 32px", opacity: active === 6 ? 1 : 0, transform: active === 6 ? "translateY(0)" : "translateY(20px)", transition: "all 0.5s ease" }}>
              From 5G to <span style={{ color: P.green }}>5G-Advanced</span> to <span style={{ color: P.magenta }}>6G</span>
            </h2>
            <EvoTimeline active={active === 6} />
          </div>
        </div>

        {/* FUTURE */}
        <div style={S}>
          <div style={{ maxWidth: 700, textAlign: "center" }}>
            <div style={{ fontSize: "clamp(32px, 5.5vw, 56px)", fontWeight: 800, fontFamily: "'Outfit', sans-serif", lineHeight: 1.15, opacity: active === 7 ? 1 : 0, transform: active === 7 ? "translateY(0)" : "translateY(25px)", transition: "all 0.6s ease" }}>
              5G SA is not just <span style={{ color: P.cyan }}>faster wireless</span>.<br />
              It's a <span style={{ background: `linear-gradient(135deg, ${P.blue}, ${P.cyan}, ${P.green})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>programmable platform</span>.
            </div>
            <p style={{ fontSize: 16, color: P.dim, marginTop: 24, lineHeight: 1.7, opacity: active === 7 ? 1 : 0, transition: "opacity 0.6s ease 0.3s" }}>
              With cloud-native architecture, network slicing, edge compute, and AI-driven automation, 5G Standalone transforms mobile networks from dumb pipes into intelligent platforms — purpose-built for every industry, every application, every moment.
            </p>

            <div style={{ marginTop: 36, opacity: active === 7 ? 1 : 0, transition: "opacity 0.6s ease 0.5s" }}>
              <a href="https://northstar-program.com/5g-sa-architecture-diagram" target="_blank" rel="noopener"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", background: `linear-gradient(135deg, ${P.blue}, ${P.cyan})`, color: P.white, borderRadius: 12, textDecoration: "none", fontWeight: 600, fontSize: 14, border: "none", transition: "transform 0.2s, box-shadow 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 24px ${P.blue}55`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >5G SA: Resource &amp; Service Architecture →</a>
            </div>

            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.15)", marginTop: 48, letterSpacing: 2 }}>TELIA — 5G STANDALONE</div>
          </div>
        </div>

      </div>
    </div>
  );
}
