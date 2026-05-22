import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react"; // 👉 ADDED Vercel Analytics import
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Analytics /> {/* 👉 ADDED component to track your traffic */}
  </StrictMode>
);