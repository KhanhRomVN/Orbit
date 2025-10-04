// File: src/presentation/components/sidebar/TabItem.tsx
import React, { useState } from "react";
import { X, Globe, MoreVertical } from "lucide-react";
import { ExtendedTab } from "@/types/tab-group";
import CustomDropdown from "../common/CustomDropdown";

interface TabItemProps {
  tab: ExtendedTab;
  onClose: (tabId: number) => void;
  currentGroupId: string;
  isActive: boolean;
  isTabActive?: boolean;
  groupType: "custom" | "container";
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  onClose,
  isActive,
  isTabActive = false,
  groupType,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const dropdownOptions = [
    {
      value: "add-proxy",
      label: "Add HTTP/SOCKS5",
      icon: "🌐",
    },
    {
      value: "sleep",
      label: "Sleep",
      icon: "💤",
    },
  ];

  const handleDropdownSelect = (value: string) => {
    setShowDropdown(false);

    switch (value) {
      case "add-proxy":
        console.log("Add HTTP/SOCKS5 clicked for tab:", tab.id);
        // TODO: Implement proxy functionality
        break;
      case "sleep":
        console.log("Sleep clicked for tab:", tab.id);
        // TODO: Implement sleep functionality
        break;
    }
  };

  const handleTabClick = async () => {
    if (tab.id) {
      try {
        if (!isActive && tab.groupId) {
          await chrome.runtime.sendMessage({
            action: "setActiveGroup",
            groupId: tab.groupId,
          });

          await new Promise((resolve) => setTimeout(resolve, 200));

          await chrome.tabs.update(tab.id, { active: true });

          if (tab.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true });
          }
        } else {
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

  const isContainerTab =
    tab.cookieStoreId && tab.cookieStoreId !== "firefox-default";
  const shouldShowBadge = groupType === "custom" && isContainerTab;

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

      {/* Container Badge - sát bên phải khi không hover */}
      {shouldShowBadge && (
        <span className="text-xs text-primary px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 flex-shrink-0 group-hover:mr-0 mr-auto">
          C
        </span>
      )}

      {/* Actions - chỉ chiếm không gian khi hover hoặc tab active */}
      <div
        className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 group-hover:w-auto w-0 overflow-hidden ${
          isTabActive ? "opacity-100 w-auto" : ""
        }`}
      >
        <button
          onClick={handleClose}
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
          title="Close tab"
        >
          <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          className="p-1 hover:bg-button-secondBgHover rounded relative z-50"
        >
          <MoreVertical className="w-3.5 h-3.5 text-text-secondary" />
        </button>
      </div>

      {/* Dropdown Menu - tách ra ngoài để tránh bị overflow-hidden */}
      {showDropdown && (
        <div className="absolute top-full right-2 mt-1 z-[9999]">
          <CustomDropdown
            options={dropdownOptions}
            onSelect={handleDropdownSelect}
            align="right"
            width="w-40"
          />
        </div>
      )}
    </div>
  );
};

export default TabItem;
