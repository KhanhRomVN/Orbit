import React, { useState, useEffect } from "react";
import { Plus, Palette } from "lucide-react";
import CustomDropdown, { DropdownOption } from "../common/CustomDropdown";
import { useTheme } from "../../providers/theme-provider";
import { PRESET_THEMES } from "../../providers/PresetTheme";

interface SidebarHeaderProps {
  onCreateGroup: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onCreateGroup }) => {
  const [zoomLevel] = useState(80);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const { theme, setColorSettings } = useTheme();

  // Apply zoom level to sidebar using transform scale
  useEffect(() => {
    const sidebarRoot = document.getElementById("sidebar-root");
    if (sidebarRoot) {
      const scale = zoomLevel / 100;
      // Remove zoom property
      sidebarRoot.style.zoom = "";
      // Apply scale transform to the wrapper inside
      const wrapper = sidebarRoot.querySelector(
        ".sidebar-zoom-wrapper"
      ) as HTMLElement;
      if (wrapper) {
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.transformOrigin = "top left";
        // Adjust wrapper width to compensate for scale
        wrapper.style.width = `${100 / scale}%`;
        wrapper.style.height = `${100 / scale}%`;
      }
    }
  }, [zoomLevel]);

  // Generate theme options from preset themes
  const effectiveTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  const themeOptions: DropdownOption[] = PRESET_THEMES[effectiveTheme].map(
    (preset) => ({
      value: preset.name,
      label: preset.name,
    })
  );

  const handleThemeSelect = (themeName: string) => {
    const selectedTheme = PRESET_THEMES[effectiveTheme].find(
      (t) => t.name === themeName
    );
    if (selectedTheme) {
      setColorSettings({
        primary: selectedTheme.primary,
        background: selectedTheme.background,
        cardBackground: selectedTheme.cardBackground,
        sidebar:
          selectedTheme.sidebarBackground || selectedTheme.cardBackground,
      });
    }
    setShowThemeDropdown(false);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border backdrop-blur-sm bg-sidebar-background/80">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="text-lg">📚</span>
        </div>
        <h1 className="text-lg font-bold text-text-primary tracking-tight">
          Sigil
        </h1>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onCreateGroup}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Create New Group"
        >
          <Plus className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowThemeDropdown(!showThemeDropdown)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Change Theme"
          >
            <Palette className="w-5 h-5" />
          </button>

          {showThemeDropdown && (
            <CustomDropdown
              options={themeOptions}
              onSelect={handleThemeSelect}
              align="right"
              width="w-48"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SidebarHeader;
