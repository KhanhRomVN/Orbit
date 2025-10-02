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
  isActive: boolean;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  onClose,
  onMove,
  isActive,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleTabClick = async () => {
    if (tab.id) {
      try {
        // If group is not active, switch to this group first
        if (!isActive && tab.groupId) {
          // Switch group first and wait for it to complete
          await chrome.runtime.sendMessage({
            action: "setActiveGroup",
            groupId: tab.groupId,
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          // Now activate the specific tab that was clicked
          await chrome.tabs.update(tab.id, { active: true });

          // Ensure window is focused
          if (tab.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true });
          }
        } else {
          // Same group, just activate the tab
          await chrome.tabs.update(tab.id, { active: true });
          await chrome.windows.update(tab.windowId!, { focused: true });
        }
      } catch (error) {
        console.error("[TabItem] ❌ ERROR:", error);
        console.error("[TabItem] Error details:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    } else {
      console.warn("[TabItem] ⚠️ No tab.id available");
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.id) {
      onClose(tab.id);
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
    <div
      className="
        flex items-center gap-1 px-2 py-1.5
        hover:bg-sidebar-itemHover 
        cursor-pointer rounded
        group
      "
      onClick={handleTabClick}
    >
      {/* File Icon */}
      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
        {tab.favIconUrl ? (
          <img
            src={tab.favIconUrl}
            alt=""
            className="w-3.5 h-3.5"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
            }}
          />
        ) : (
          <Globe className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
        )}
      </div>

      {/* Tab Title */}
      <span className="flex-1 text-sm text-text-primary truncate">
        {tab.title || "New Tab"}
      </span>

      {/* Actions - Show on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="Move to another group"
          >
            <Move className="w-3 h-3 text-gray-600 dark:text-gray-400" />
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
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
          title="Close tab"
        >
          <X className="w-3 h-3 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
        </button>
      </div>
    </div>
  );
};

export default TabItem;
