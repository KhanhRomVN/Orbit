import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "@/presentation/components/sidebar/Sidebar";
import { ThemeProvider } from "@/presentation/providers/theme-provider";
import "@/styles/index.css";

createRoot(document.getElementById("sidebar-root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="orbit-sidebar-theme">
      <Sidebar />
    </ThemeProvider>
  </StrictMode>
);
