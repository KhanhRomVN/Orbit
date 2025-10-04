import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Globe, MoreVertical } from "lucide-react";
import { ExtendedTab } from "@/types/tab-group";
import CustomDropdown from "../common/CustomDropdown";
import { useZoom } from "../../../shared/hooks/useZoom";
import { ProxyManager } from "@/shared/lib/proxy-manager";

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
  const { zoomLevel } = useZoom();
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [containerHasProxy, setContainerHasProxy] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [containerHasFocused, setContainerHasFocused] = useState(false);

  useEffect(() => {
    checkFocusStatus();
  }, [tab.id, tab.cookieStoreId]);

  useEffect(() => {
    const checkContainerProxy = async () => {
      if (tab.cookieStoreId && tab.cookieStoreId !== "firefox-default") {
        const proxyId = await ProxyManager.getContainerProxy(tab.cookieStoreId);
        setContainerHasProxy(!!proxyId);
      } else {
        setContainerHasProxy(false);
      }
    };

    checkContainerProxy();
  }, [tab.cookieStoreId]);

  // Calculate dropdown position with zoom compensation
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const scale = zoomLevel / 100;
      const dropdownWidth = 160; // w-40 = 10rem = 160px

      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.right - dropdownWidth,
      });
    }
  }, [showDropdown, zoomLevel]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside both button and dropdown
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const isClaudeTab = tab.url?.includes("claude.ai") || false;
  const isContainerTab =
    tab.cookieStoreId && tab.cookieStoreId !== "firefox-default";
  const canShowFocusOption =
    isClaudeTab && isContainerTab && !containerHasFocused;
  const canShowUnfocusOption = isClaudeTab && isContainerTab && isFocused;

  const dropdownOptions = [
    ...(canShowFocusOption
      ? [
          {
            value: "set-focus",
            label: "Chatbot Focus",
            icon: "🎯",
          },
        ]
      : []),
    ...(canShowUnfocusOption
      ? [
          {
            value: "remove-focus",
            label: "Remove Focus",
            icon: "❌",
          },
        ]
      : []),
    {
      value: "sleep",
      label: "Sleep",
      icon: "💤",
    },
  ];

  const checkFocusStatus = async () => {
    if (!tab.cookieStoreId || tab.cookieStoreId === "firefox-default") {
      setIsFocused(false);
      setContainerHasFocused(false);
      return;
    }

    try {
      const result = await chrome.runtime.sendMessage({
        action: "getFocusedTab",
        containerId: tab.cookieStoreId,
      });

      const focusedTabId = result?.focusedTabId;

      if (focusedTabId) {
        setIsFocused(focusedTabId === tab.id);
        setContainerHasFocused(true);
      } else {
        setIsFocused(false);
        setContainerHasFocused(false);
      }
    } catch (error) {
      console.error("Failed to check focus status:", error);
    }
  };

  const handleSetFocus = async () => {
    if (!tab.id || !tab.cookieStoreId) return;

    try {
      await chrome.runtime.sendMessage({
        action: "setTabFocus",
        tabId: tab.id,
        containerId: tab.cookieStoreId,
      });

      await checkFocusStatus();
    } catch (error) {
      console.error("Failed to set tab focus:", error);
    }
  };

  const handleRemoveFocus = async () => {
    if (!tab.id) return;

    try {
      await chrome.runtime.sendMessage({
        action: "removeTabFocus",
        tabId: tab.id,
      });

      await checkFocusStatus();
    } catch (error) {
      console.error("Failed to remove tab focus:", error);
    }
  };

  const handleDropdownSelect = (value: string) => {
    switch (value) {
      case "set-focus":
        handleSetFocus();
        setShowDropdown(false);
        break;
      case "remove-focus":
        handleRemoveFocus();
        setShowDropdown(false);
        break;
      case "sleep":
        handleSleepTab();
        setShowDropdown(false);
        break;
      default:
        setShowDropdown(false);
        break;
    }
  };

  const handleSleepTab = async () => {
    if (!tab.id || tab.active) return;

    try {
      await chrome.tabs.discard(tab.id);
    } catch (error) {
      console.error("Failed to sleep tab:", error);
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

  const shouldShowBadge = groupType === "custom" && isContainerTab;

  return (
    <>
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

        {/* Badges */}
        <div className="flex items-center gap-1 flex-shrink-0 group-hover:mr-0 mr-auto">
          {shouldShowBadge && (
            <span className="text-xs text-primary px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30">
              C
            </span>
          )}
          {containerHasProxy && (
            <span className="text-xs text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30">
              P
            </span>
          )}
          {isFocused && (
            <span className="text-xs text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-900/30">
              F
            </span>
          )}
        </div>

        {/* Actions */}
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
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="p-1 hover:bg-button-secondBgHover rounded"
          >
            <MoreVertical className="w-3.5 h-3.5 text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Dropdown Menu - render qua Portal */}
      {showDropdown &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999]"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
            }}
          >
            <CustomDropdown
              options={dropdownOptions}
              onSelect={handleDropdownSelect}
              align="right"
              width="w-40"
            />
          </div>,
          document.body
        )}
    </>
  );
};

export default TabItem;
