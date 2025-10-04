import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "@/presentation/components/sidebar/Sidebar";
import { ThemeProvider } from "@/presentation/providers/theme-provider";
import { ZoomProvider } from "@/shared/hooks/useZoom";
import "@/styles/index.css";

createRoot(document.getElementById("sidebar-root")!).render(
  <StrictMode>
    <ZoomProvider defaultValue={100}>
      <ThemeProvider defaultTheme="dark" storageKey="sigil-sidebar-theme">
        <Sidebar />
      </ThemeProvider>
    </ZoomProvider>
  </StrictMode>
);
