import { createRoot } from "react-dom/client";
import { initAuth, openLogin } from "./studio/auth";

// When Netlify Identity is enabled and nobody is signed in, show this landing
// gate instead of the editor. The widget handles sign-up, sign-in and
// password recovery; a successful login reloads the page into the editor.
function SignInGate() {
  const wrap = {
    position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 14, background: "radial-gradient(circle at 70% 20%, rgba(0,212,255,.10), transparent 55%), radial-gradient(circle at 20% 80%, rgba(108,92,231,.18), transparent 55%), #0B1026",
    color: "#E9ECFF", textAlign: "center", padding: 24,
  };
  return (
    <div style={wrap}>
      <div style={{ fontWeight: 700, letterSpacing: 0.5, color: "#00D4FF", fontSize: 22 }}>◆ Presentation Studio</div>
      <p style={{ margin: 0, maxWidth: 420, color: "rgba(233,236,255,0.65)", fontSize: 14.5, lineHeight: 1.6 }}>
        Sign in — or create a free account — to open your presentations.
        Your decks are private to your account and sync across your devices.
      </p>
      <button
        onClick={openLogin}
        style={{ font: "inherit", fontWeight: 600, fontSize: 15, padding: "11px 26px", borderRadius: 10, border: 0, cursor: "pointer", background: "#6C5CE7", color: "#fff" }}
      >
        Sign in / Sign up
      </button>
    </div>
  );
}

const container = document.getElementById("studio-root");
if (container) {
  initAuth().then(async ({ mode, user }) => {
    const root = createRoot(container);
    if (mode === "identity" && !user) {
      root.render(<SignInGate />);
      return;
    }
    // Imported only now so model.js reads the resolved auth scope at init.
    const { default: StudioApp } = await import("./studio/app.jsx");
    root.render(<StudioApp />);
  });
}
