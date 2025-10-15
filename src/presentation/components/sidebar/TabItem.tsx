import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Globe, MoreVertical, Package, BedSingle } from "lucide-react";
import { ExtendedTab } from "@/types/tab-group";
import { ProxyManager } from "@/shared/lib/proxy-manager";
import CustomDropdown from "../common/CustomDropdown";

interface TabItemProps {
  tab: ExtendedTab;
  onClose: (tabId: number) => void;
  currentGroupId: string;
  isActive: boolean;
  isTabActive?: boolean;
  groupType: "custom" | "container";
  groupHasProxy: boolean;
  onProxyChanged: () => Promise<void>;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  onClose,
  isActive,
  isTabActive = false,
  groupType,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [containerHasProxy, setContainerHasProxy] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [, setContainerHasFocused] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);

  useEffect(() => {
    checkFocusStatus();
    checkSleepStatus();

    // Listen for tab discarded/undiscarded events
    const handleTabUpdate = (tabId: number, changeInfo: any) => {
      if (tabId === tab.id && changeInfo.discarded !== undefined) {
        setIsSleeping(changeInfo.discarded);
      }
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    return () => chrome.tabs.onUpdated.removeListener(handleTabUpdate);
  }, [tab.id, tab.cookieStoreId]);

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (
        message.action === "focusChanged" &&
        message.containerId === tab.cookieStoreId
      ) {
        checkFocusStatus();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [tab.cookieStoreId]);

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
      const dropdownWidth = 160; // w-40 = 10rem = 160px

      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.right - dropdownWidth,
      });
    }
  }, [showDropdown]);

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

  const isContainerTab =
    tab.cookieStoreId && tab.cookieStoreId !== "firefox-default";

  const checkFocusStatus = () => {
    if (!tab.cookieStoreId || tab.cookieStoreId === "firefox-default") {
      setIsFocused(false);
      setContainerHasFocused(false);
      return;
    }

    // ✅ Dùng callback pattern thay vì Promise cho Firefox manifest v2
    chrome.runtime.sendMessage(
      {
        action: "getFocusedTab",
        containerId: tab.cookieStoreId,
      },
      (result) => {
        // Kiểm tra runtime error
        if (chrome.runtime.lastError) {
          console.error("[TabItem] Runtime error:", chrome.runtime.lastError);
          setIsFocused(false);
          setContainerHasFocused(false);
          return;
        }

        const focusedTabId = result?.focusedTabId;

        if (focusedTabId !== undefined && focusedTabId !== null) {
          setIsFocused(focusedTabId === tab.id);
          setContainerHasFocused(true);
        } else {
          setIsFocused(false);
          setContainerHasFocused(false);
        }
      }
    );
  };

  const checkSleepStatus = () => {
    if (!tab.id) {
      setIsSleeping(false);
      return;
    }

    chrome.tabs.get(tab.id, (tabInfo) => {
      if (chrome.runtime.lastError) {
        setIsSleeping(false);
        return;
      }
      setIsSleeping(tabInfo.discarded === true);
    });
  };

  const handleTabClick = async () => {
    if (!tab.id) {
      try {
        // ✅ Dùng callback pattern cho Firefox manifest v2
        const createTabOptions: any = {
          url: tab.url,
          active: true,
        };

        // Chỉ thêm cookieStoreId nếu không phải default
        if (tab.cookieStoreId && tab.cookieStoreId !== "firefox-default") {
          createTabOptions.cookieStoreId = tab.cookieStoreId;
        }

        chrome.tabs.create(createTabOptions, () => {
          if (chrome.runtime.lastError) {
            console.error(
              "[TabItem] ❌ Failed to create tab:",
              chrome.runtime.lastError
            );
            alert(`Failed to create tab: ${chrome.runtime.lastError.message}`);
            return;
          }
        });
      } catch (error) {
        console.error("[TabItem] ❌ Failed to create tab:", error);
        alert(
          `Failed to create tab: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
      return;
    }

    if (tab.id) {
      try {
        // Kiểm tra tab có còn tồn tại không (Firefox-compatible)
        const tabExists = await new Promise<boolean>((resolve) => {
          chrome.tabs.get(tab.id!, () => {
            if (chrome.runtime.lastError) {
              console.error(
                "[TabItem] ❌ Tab không tồn tại:",
                chrome.runtime.lastError.message
              );
              resolve(false);
            } else {
              resolve(true);
            }
          });
        });

        if (!tabExists) {
          console.error("[TabItem] ❌ Tab không tồn tại:", tab.id);
          alert(
            `Tab "${tab.title}" không tồn tại.\n\nCó thể đã bị đóng hoặc là dữ liệu từ backup.\n\nHãy tạo lại tab bằng cách click "Add New Tab" trong group.`
          );
          return;
        }

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
        alert(
          `Không thể chuyển đến tab: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } else {
      console.warn("[TabItem] ⚠️ Tab không có ID");
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
                : isSleeping
                ? "text-text-secondary"
                : "text-text-primary group-hover:text-text-primary"
            }
          `}
        >
          {tab.title || "New Tab"}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-1 flex-shrink-0 group-hover:mr-0 mr-auto">
          {shouldShowBadge && (
            <span className="text-xs text-primary px-1 py-1 rounded bg-blue-50 dark:bg-blue-900/30">
              <Package className="w-3 h-3" />
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
          {isSleeping && (
            <span className="text-xs text-gray-700 dark:text-gray-300 px-1 py-1 rounded bg-gray-50 dark:bg-gray-900/30">
              <BedSingle className="w-3 h-3" />
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
              options={[
                ...(!isFocused && !isTabActive && tab.id
                  ? [
                      {
                        value: "sleep",
                        label: "Sleep Tab",
                        icon: "💤",
                      },
                    ]
                  : []),
              ]}
              onSelect={(value) => {
                setShowDropdown(false);
                if (value === "sleep" && tab.id) {
                  // ✅ FIX: Wrap trong Promise vì Firefox trả về undefined
                  Promise.resolve(chrome.tabs.discard(tab.id)).catch(
                    (error) => {
                      console.error("[TabItem] Failed to sleep tab:", error);
                    }
                  );
                }
              }}
              align="right"
              width="w-36"
            />
          </div>,
          document.body
        )}
    </>
  );
};

export default TabItem;
