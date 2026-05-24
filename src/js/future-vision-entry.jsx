import { createRoot } from "react-dom/client";
import NorthStarFutureVision from "./northstar-future-vision.jsx";

const container = document.getElementById("future-vision-root");
if (container) {
  createRoot(container).render(<NorthStarFutureVision />);
}
