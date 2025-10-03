// File: src/presentation/components/sidebar/TabItem.tsx
import React from "react";
import { X, Globe } from "lucide-react";
import { ExtendedTab } from "@/types/tab-group";

interface TabItemProps {
  tab: ExtendedTab;
  onClose: (tabId: number) => void;
  currentGroupId: string;
  isActive: boolean;
  isTabActive?: boolean; // Tab is currently focused in browser
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  onClose,
  isActive,
  isTabActive = false,
}) => {
  const handleTabClick = async () => {
    if (tab.id) {
      try {
        // If group is not active, switch to this group first
        if (!isActive && tab.groupId) {
          await chrome.runtime.sendMessage({
            action: "setActiveGroup",
            groupId: tab.groupId,
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          // Now activate the specific tab
          await chrome.tabs.update(tab.id, { active: true });

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
      }
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.id) {
      onClose(tab.id);
    }
  };

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 rounded-md
        cursor-pointer transition-all duration-150
        group relative
      `}
      onClick={handleTabClick}
    >
      {/* Active indicator */}
      {isTabActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full" />
      )}

      {/* Favicon */}
      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 ml-1">
        {tab.favIconUrl ? (
          <img
            src={tab.favIconUrl}
            alt=""
            className="w-4 h-4 object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
            }}
          />
        ) : (
          <Globe className="w-4 h-4 text-text-primary" />
        )}
      </div>

      {/* Tab Title */}
      <span
        className={`
        flex-1 text-sm truncate transition-colors
        ${
          isTabActive
            ? "text-primary font-medium"
            : "text-text-primary group-hover:text-text-primary"
        }
      `}
      >
        {tab.title || "New Tab"}
      </span>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className={`
          p-1 rounded opacity-0 group-hover:opacity-100 
          hover:bg-red-100 dark:hover:bg-red-900/30 
          transition-all duration-150 flex-shrink-0
          ${isTabActive ? "opacity-100" : ""}
        `}
        title="Close tab"
      >
        <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
      </button>
    </div>
  );
};

export default TabItem;
