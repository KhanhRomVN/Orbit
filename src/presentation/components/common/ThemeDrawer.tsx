import React from "react";
import MotionCustomDrawer from "./CustomDrawer";
import CustomButton from "./CustomButton";
import { useTheme } from "../../providers/theme-provider";
import { PRESET_THEMES } from "../../providers/PresetTheme";

interface ThemeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ThemeDrawer: React.FC<ThemeDrawerProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme, colorSettings, setColorSettings } = useTheme();

  // Apply preset color theme to CSS variables and state
  const applyPresetTheme = (preset: any) => {
    const newColorSettings = {
      primary: preset.primary,
      background: preset.background,
      textPrimary: preset.textPrimary || "#0f172a",
      textSecondary: preset.textSecondary || "#475569",
      border: preset.border || "#e2e8f0",
      borderHover: preset.borderHover || "#cbd5e1",
      borderFocus: preset.borderFocus || "#cbd5e1",
      cardBackground: preset.cardBackground,
      inputBackground: preset.inputBackground || preset.cardBackground,
      dialogBackground: preset.dialogBackground || preset.cardBackground,
      dropdownBackground: preset.dropdownBackground || preset.cardBackground,
      dropdownItemHover: preset.dropdownItemHover || "#f8fafc",
      sidebarBackground: preset.sidebarBackground || preset.cardBackground,
      sidebarItemHover: preset.sidebarItemHover || "#f3f4f6",
      sidebarItemFocus: preset.sidebarItemFocus || "#e5e7eb",
      buttonBg: preset.buttonBg || preset.primary,
      buttonBgHover: preset.buttonBgHover || preset.primary,
      buttonText: preset.buttonText || "#ffffff",
      buttonBorder: preset.buttonBorder || preset.primary,
      buttonBorderHover: preset.buttonBorderHover || preset.primary,
      buttonSecondBg: preset.buttonSecondBg || "#d4d4d4",
      buttonSecondBgHover: preset.buttonSecondBgHover || "#b6b6b6",
      bookmarkItemBg: preset.bookmarkItemBg || preset.cardBackground,
      bookmarkItemText:
        preset.bookmarkItemText || preset.textPrimary || "#0f172a",
      drawerBackground: preset.drawerBackground || preset.cardBackground,
      clockGradientFrom: preset.clockGradientFrom || preset.primary,
      clockGradientTo: preset.clockGradientTo || preset.primary,
      cardShadow: preset.cardShadow,
      dialogShadow: preset.dialogShadow,
      dropdownShadow: preset.dropdownShadow,
    };

    setColorSettings(newColorSettings);
  };

  // Icons for theme modes
  const LightIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707
           M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707
           M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );

  const DarkIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646
           9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );

  const SystemIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );

  // Get effective theme for preset selection
  const getEffectiveTheme = (): "light" | "dark" => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return theme;
  };

  // Theme mode buttons
  const renderThemeSelector = () => (
    <div className="mb-4">
      <h3 className="text-sm font-semibold mb-3 text-text-primary">
        Theme Mode
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {[
          { mode: "light", Icon: LightIcon, label: "Light" },
          { mode: "dark", Icon: DarkIcon, label: "Dark" },
          { mode: "system", Icon: SystemIcon, label: "System" },
        ].map(({ mode, Icon, label }) => (
          <button
            key={mode}
            onClick={() => setTheme(mode as any)}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all
              ${
                theme === mode
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : "border-border hover:bg-sidebar-itemHover"
              }`}
          >
            <div
              className={`mb-1.5 p-1.5 rounded-full ${
                mode === "light"
                  ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : mode === "dark"
                  ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              <Icon />
            </div>
            <span className="font-medium text-xs text-text-primary">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  // Preset color swatches
  const renderPresetThemes = () => {
    const effectiveTheme = getEffectiveTheme();
    const presets = PRESET_THEMES[effectiveTheme];

    return (
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-3 text-text-primary">
          Preset Themes
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {presets.map((preset, idx) => {
            const isSelected =
              colorSettings.primary === preset.primary &&
              colorSettings.background === preset.background &&
              colorSettings.cardBackground === preset.cardBackground;

            return (
              <button
                key={idx}
                onClick={() => applyPresetTheme(preset)}
                className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all overflow-hidden
                  ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : "border-border hover:bg-sidebar-itemHover"
                  }`}
              >
                {/* Preview Box */}
                <div className="w-14 h-14 rounded-md overflow-hidden border border-border flex-shrink-0 relative">
                  <div
                    className="h-2 w-full"
                    style={{ backgroundColor: preset.primary }}
                  />
                  <div className="flex h-12">
                    <div
                      className="w-1/4 h-full"
                      style={{
                        backgroundColor:
                          preset.sidebarBackground || preset.cardBackground,
                      }}
                    />
                    <div
                      className="w-3/4 h-full p-1"
                      style={{ backgroundColor: preset.background }}
                    >
                      <div
                        className="w-full h-2 rounded mb-0.5"
                        style={{ backgroundColor: preset.cardBackground }}
                      />
                      <div
                        className="w-3/4 h-2 rounded"
                        style={{ backgroundColor: preset.cardBackground }}
                      />
                    </div>
                  </div>
                  {preset.icon && (
                    <div className="absolute top-1 right-1 text-xs">
                      {preset.icon}
                    </div>
                  )}
                </div>

                {/* Theme Info */}
                <div className="flex-1 min-w-0 text-left">
                  <span className="font-medium text-sm block text-text-primary truncate">
                    {preset.name}
                  </span>
                  <span className="text-xs text-text-secondary truncate block">
                    {preset.description || "Modern theme"}
                  </span>
                  {/* Color Palette */}
                  <div className="flex mt-1.5 gap-0.5">
                    {[
                      "primary",
                      "background",
                      "cardBackground",
                      "textPrimary",
                    ].map((k) => (
                      <div
                        key={k}
                        className="h-1.5 flex-1 rounded-full"
                        style={{
                          backgroundColor: (preset as any)[k] || "#000",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Selected Check */}
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-green-500 flex-shrink-0"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293
                             a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293
                             a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <MotionCustomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Theme Settings"
      subtitle="Customize the look and feel"
      direction="right"
      size="full"
      animationType="slide"
      enableBlur={false}
      closeOnOverlayClick={true}
      showCloseButton={true}
      footerActions={
        <>
          <CustomButton variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton variant="primary" size="sm" onClick={onClose}>
            Apply
          </CustomButton>
        </>
      }
    >
      <div className="h-full overflow-y-auto bg-drawer-background">
        <div className="p-4 space-y-4">
          {renderThemeSelector()}
          {renderPresetThemes()}
        </div>
      </div>
    </MotionCustomDrawer>
  );
};

export default ThemeDrawer;
