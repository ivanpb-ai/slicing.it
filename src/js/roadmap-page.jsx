import { createRoot } from "react-dom/client";
import { P } from "./palette";
import { COPY } from "./copy";
import { RoadmapView, Kicker, Heading } from "./northstar-future-vision.jsx";

const FF_BODY = "'Telia Sans', system-ui, -apple-system, sans-serif";

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
      <div style={{ maxWidth: 1080, width: "100%" }}>
        <Kicker color={P.cyan}>{COPY.roadmap.kicker}</Kicker>
        <Heading parts={COPY.roadmap.headline} size="clamp(26px, 5vw, 50px)" mb={26} />
        <RoadmapView active={true} />
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<Page />);
