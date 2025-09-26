import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Popup from "@/presentation/components/popup/Popup";
import "@/styles/index.css";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/presentation/providers/theme-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

createRoot(document.getElementById("popup-root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <Popup />
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  </StrictMode>
);
