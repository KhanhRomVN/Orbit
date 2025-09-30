// File: src/presentation/components/sidebar/TabItem.tsx
import React, { useState } from "react";
import { X, Move, Globe } from "lucide-react";
import { ExtendedTab } from "@/types/tab-group";
import CustomDropdown from "../common/CustomDropdown";

interface TabItemProps {
  tab: ExtendedTab;
  onClose: (tabId: number) => void;
  onMove: (tabId: number, newGroupId: string) => void;
  currentGroupId: string;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  onClose,
  onMove,
  currentGroupId,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleTabClick = async () => {
    if (tab.id) {
      try {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId!, { focused: true });
      } catch (error) {
        console.error("Failed to activate tab:", error);
      }
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.id) {
      onClose(tab.id);
    }
  };

  const getFaviconUrl = (url: string | undefined) => {
    if (!url) return "";
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return "";
    }
  };

  const moveOptions = [
    {
      value: "move-to-new",
      label: "Move to New Group",
      icon: "🆕",
    },
    // These will be populated with actual groups
  ];

  const handleMoveSelect = (value: string) => {
    setShowDropdown(false);
    if (value !== "move-to-new" && tab.id) {
      onMove(tab.id, value);
    }
  };

  return (
    <div className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
      <div
        className="flex items-center space-x-2 flex-1 min-w-0 cursor-pointer"
        onClick={handleTabClick}
      >
        {/* Favicon */}
        <div className="flex-shrink-0 w-4 h-4">
          {tab.favIconUrl ? (
            <img
              src={tab.favIconUrl}
              alt=""
              className="w-4 h-4"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          ) : (
            <Globe className="w-4 h-4 text-gray-400" />
          )}
        </div>

        {/* Title */}
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
          {tab.title || "New Tab"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Move to another group"
          >
            <Move className="w-3 h-3" />
          </button>

          {showDropdown && (
            <CustomDropdown
              options={moveOptions}
              onSelect={handleMoveSelect}
              align="right"
              width="w-40"
            />
          )}
        </div>

        <button
          onClick={handleClose}
          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title="Close tab"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default TabItem;
