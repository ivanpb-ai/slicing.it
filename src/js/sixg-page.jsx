import { createRoot } from "react-dom/client";
import { P } from "./palette";
import { COPY } from "./copy";
import { SixGRoadmap, Kicker, Heading, Lede } from "./northstar-future-vision.jsx";

const FF_BODY = "'Telia Sans', system-ui, -apple-system, sans-serif";
const FF_MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace";

const backStyle = {
  position: "fixed", top: 18, left: 24, fontFamily: FF_BODY, fontSize: 13, color: P.light,
  textDecoration: "none", letterSpacing: 1, opacity: 0.75, padding: "6px 13px", borderRadius: 999,
  border: "1px solid rgba(244,224,255,0.25)",
};

function Page() {
  return (
    <div style={{
      minHeight: "100vh", boxSizing: "border-box", color: P.white, fontFamily: FF_BODY,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "84px 28px 56px", position: "relative",
      background: "radial-gradient(circle at 70% 20%, rgba(0,212,255,0.10), transparent 55%), radial-gradient(circle at 20% 80%, rgba(153,10,227,0.18), transparent 55%), #29003E",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <a href="index.html" style={backStyle}>{COPY.ui.backLink}</a>
      <div style={{ maxWidth: 1100, width: "100%" }}>
        <Kicker color={P.gold}>{COPY.sixg.kicker}</Kicker>
        <Heading parts={COPY.sixg.headline} size="clamp(26px, 5vw, 50px)" mb={12} />
        <Lede size={13} mb={28} max={800}>{COPY.sixg.body}</Lede>
        <SixGRoadmap active={true} />
        <div style={{
          marginTop: 24, padding: "16px 24px", background: `linear-gradient(135deg, ${P.gold}10, ${P.purple}10)`,
          border: `1px solid ${P.gold}33`, borderRadius: 12, fontSize: 12, color: "rgba(244,224,255,0.78)", lineHeight: 1.65, textAlign: "center",
        }}>
          <strong style={{ color: P.gold, fontFamily: FF_MONO, fontSize: 11, letterSpacing: 1 }}>{COPY.sixg.note.label}</strong>
          {COPY.sixg.note.text}
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<Page />);
