import React, { useState, useEffect, useRef } from "react";
import { Plus, Palette } from "lucide-react";
import CustomDropdown, { DropdownOption } from "../common/CustomDropdown";
import { useTheme } from "../../providers/theme-provider";
import { PRESET_THEMES } from "../../providers/PresetTheme";
import { createPortal } from "react-dom";
import { useZoom } from "../../../shared/hooks/useZoom";

interface SidebarHeaderProps {
  onCreateGroup: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onCreateGroup }) => {
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const { setColorSettings } = useTheme();
  const { zoomLevel } = useZoom();
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        themeButtonRef.current &&
        !themeButtonRef.current.contains(event.target as Node)
      ) {
        setShowThemeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Generate theme options from ALL preset themes
  const themeOptions: DropdownOption[] = [
    // Light themes
    ...PRESET_THEMES.light.map((preset) => ({
      value: `light-${preset.name}`,
      label: `☀️ ${preset.name}`,
    })),
    // Dark themes
    ...PRESET_THEMES.dark.map((preset) => ({
      value: `dark-${preset.name}`,
      label: `🌙 ${preset.name}`,
    })),
  ];

  const handleThemeSelect = (themeValue: string) => {
    const [themeMode, ...themeNameParts] = themeValue.split("-");
    const themeName = themeNameParts.join("-");

    const selectedTheme = PRESET_THEMES[themeMode as "light" | "dark"].find(
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

  // Calculate dropdown position
  const getDropdownPosition = () => {
    if (!themeButtonRef.current) return { top: 0, left: 0 };

    const rect = themeButtonRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + window.scrollY + 4,
      left: rect.right + window.scrollX - 192, // Adjust based on dropdown width
    };
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border backdrop-blur-sm bg-sidebar-background/80">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="text-lg">📚</span>
        </div>
        <h1 className="text-lg font-bold text-text-primary tracking-tight">
          Orbit
        </h1>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onCreateGroup}
          className="p-2 text-text-secondary hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Create New Group"
        >
          <Plus className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            ref={themeButtonRef}
            onClick={() => setShowThemeDropdown(!showThemeDropdown)}
            className="p-2 text-text-secondary hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Change Theme"
          >
            <Palette className="w-5 h-5" />
          </button>

          {showThemeDropdown &&
            createPortal(
              <div
                ref={dropdownRef}
                className="fixed z-50"
                style={getDropdownPosition()}
              >
                <CustomDropdown
                  options={themeOptions}
                  onSelect={handleThemeSelect}
                  align="right"
                  width="w-48"
                />
              </div>,
              document.body
            )}
        </div>

        {/* Zoom Level Indicator - căn giữa với các button */}
        <span className="flex items-center px-2 py-1 text-xs text-text-secondary bg-button-secondBg rounded">
          {Math.round(zoomLevel)}%
        </span>
      </div>
    </div>
  );
};

export default SidebarHeader;
