import { createContext, useContext, useEffect, useState } from "react";
import { PRESET_THEMES } from "./PresetTheme";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ColorSettings = {
  primary: string;
  background: string;
  cardBackground: string;
  sidebar: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorSettings: ColorSettings;
  setColorSettings: (settings: ColorSettings) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  colorSettings: {
    primary: "#3686ff",
    background: "#ffffff",
    cardBackground: "#ffffff",
    sidebar: "#f9fafb",
  },
  setColorSettings: () => {},
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  // Persisted color settings for light/dark themes
  const [colorSettings, setColorSettings] = useState<ColorSettings>(() => {
    const saved = localStorage.getItem(`${storageKey}-colors`);
    if (saved) {
      return JSON.parse(saved);
    }

    // Default fallback based on defaultTheme
    let defaultColors: ColorSettings;
    if (defaultTheme === "dark") {
      // Use Midnight Dark preset by name
      const midnight = PRESET_THEMES.dark.find(
        (t) => t.name === "Midnight Dark"
      );
      defaultColors = midnight
        ? {
            primary: midnight.primary,
            background: midnight.background,
            cardBackground: midnight.cardBackground,
            sidebar: midnight.sidebarBackground || midnight.cardBackground,
          }
        : {
            primary: "#3686ff",
            background: "#0a0a0a",
            cardBackground: "#242424",
            sidebar: "#131313",
          };
    } else {
      defaultColors = {
        primary: "#3686ff",
        background: "#ffffff",
        cardBackground: "#ffffff",
        sidebar: "#f9fafb",
      };
    }
    return defaultColors;
  });

  const updateColorSettings = (settings: ColorSettings) => {
    setColorSettings(settings);
    localStorage.setItem(`${storageKey}-colors`, JSON.stringify(settings));
  };

  const applyTheme = () => {
    const root = window.document.documentElement;

    // Clear existing theme classes
    root.classList.remove("light", "dark");

    // Clear all inline CSS variables
    Array.from(root.style)
      .filter((prop) => prop.startsWith("--"))
      .forEach((prop) => root.style.removeProperty(prop));

    // Determine effective theme
    const effectiveTheme: Theme =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;

    // Apply theme class
    root.classList.add(effectiveTheme);

    // Apply color variables for light/dark
    Object.entries(colorSettings).forEach(([key, value]) => {
      // Convert camelCase key to kebab-case CSS variable
      const varName = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      root.style.setProperty(varName, value as string);
    });

    // Apply clock gradient from preset for palette themes
    const palettePresets = PRESET_THEMES[effectiveTheme];
    const matched = palettePresets?.find(
      (p) =>
        p.primary === colorSettings.primary &&
        p.background === colorSettings.background &&
        p.cardBackground === colorSettings.cardBackground
    );

    if (matched?.clockGradientFrom && matched?.clockGradientTo) {
      root.style.setProperty(
        "--clock-gradient-from",
        matched.clockGradientFrom
      );
      root.style.setProperty("--clock-gradient-to", matched.clockGradientTo);
    }
  };

  useEffect(() => {
    applyTheme();
  }, [theme, colorSettings]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    colorSettings,
    setColorSettings: updateColorSettings,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
