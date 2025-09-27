// File: src/popup.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Popup from "@/presentation/components/popup/Popup";
import "@/styles/index.css";

createRoot(document.getElementById("popup-root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
