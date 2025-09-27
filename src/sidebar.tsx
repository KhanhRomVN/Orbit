import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "@/presentation/components/sidebar/Sidebar";
import "@/styles/index.css";

createRoot(document.getElementById("sidebar-root")!).render(
  <StrictMode>
    <Sidebar />
  </StrictMode>
);
