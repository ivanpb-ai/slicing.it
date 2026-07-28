import { createRoot } from "react-dom/client";
import StudioApp from "./studio/app.jsx";

const container = document.getElementById("studio-root");
if (container) {
  createRoot(container).render(<StudioApp />);
}
