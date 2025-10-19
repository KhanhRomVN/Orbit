import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Globe, MoreVertical } from "lucide-react";
import { ExtendedTab } from "../../../types/tab-group";
import { ProxyManager } from "@/shared/lib/proxy-manager";
import CustomDropdown from "../common/CustomDropdown";
import { getBrowserAPI } from "@/shared/lib/browser-api";

interface TabItemProps {
  tab: ExtendedTab;
  onClose: (tabId: number) => void;
  currentGroupId: string;
  isActive: boolean;
  isTabActive?: boolean;
  groupType: "custom" | "container";
  groupHasProxy: boolean;
  onProxyChanged: () => Promise<void>;
  tabIndex: number; // THÊM DÒNG NÀY
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  onClose,
  isActive,
  isTabActive = false,
  groupType,
  tabIndex, // THÊM DÒNG NÀY
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, setContainerHasProxy] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [, setContainerHasFocused] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [containerColor, setContainerColor] = useState<string | null>(null);

  const getContainerTextColor = (color: string | null): string => {
    if (!color) return "";

    const colorMap: { [key: string]: string } = {
      blue: "text-blue-600 dark:text-blue-400",
      turquoise: "text-cyan-600 dark:text-cyan-400",
      green: "text-green-600 dark:text-green-400",
      yellow: "text-yellow-600 dark:text-yellow-400",
      orange: "text-orange-600 dark:text-orange-400",
      red: "text-red-600 dark:text-red-400",
      pink: "text-pink-600 dark:text-pink-400",
      purple: "text-purple-600 dark:text-purple-400",
      toolbar: "text-gray-600 dark:text-gray-400",
    };

    return colorMap[color] || "";
  };

  const getContainerBgColor = (color: string | null): string => {
    if (!color) return "bg-primary";

    const bgMap: { [key: string]: string } = {
      blue: "bg-blue-600 dark:bg-blue-400",
      turquoise: "bg-cyan-600 dark:bg-cyan-400",
      green: "bg-green-600 dark:bg-green-400",
      yellow: "bg-yellow-600 dark:bg-yellow-400",
      orange: "bg-orange-600 dark:bg-orange-400",
      red: "bg-red-600 dark:bg-red-400",
      pink: "bg-pink-600 dark:bg-pink-400",
      purple: "bg-purple-600 dark:bg-purple-400",
      toolbar: "bg-gray-600 dark:bg-gray-400",
    };

    return bgMap[color] || "bg-primary";
  };

  const loadContainerColor = async () => {
    if (tab.cookieStoreId && tab.cookieStoreId !== "firefox-default") {
      try {
        const browserAPI = getBrowserAPI();
        if (browserAPI.contextualIdentities) {
          const containers = await browserAPI.contextualIdentities.query({});
          const container = containers.find(
            (c) => c.cookieStoreId === tab.cookieStoreId
          );
          setContainerColor(container?.color || null);
        }
      } catch (error) {
        console.error("[TabItem] Failed to load container color:", error);
        setContainerColor(null);
      }
    } else {
      setContainerColor(null);
    }
  };

  useEffect(() => {
    checkFocusStatus();
    checkSleepStatus();
    loadContainerColor();

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
    // ✅ TRƯỜNG HỢP 1: Tab chưa có ID (metadata từ backup)
    if (!tab.id) {
      try {
        // ✅ BƯỚC 1: XÓA METADATA TAB NGAY LẬP TỨC
        await new Promise<void>((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: "removeMetadataTabAtPosition",
              groupId: tab.groupId,
              tabUrl: tab.url,
              tabTitle: tab.title,
              position: tabIndex,
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[TabItem] ❌ Failed to remove metadata:",
                  chrome.runtime.lastError
                );
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              resolve();
            }
          );
        });

        // Đợi UI sync (quan trọng!)
        await new Promise((resolve) => setTimeout(resolve, 100));

        // ✅ BƯỚC 2: CHUYỂN GROUP THÀNH ACTIVE (nếu cần) VÀ ĐẢM BẢO ẨN TAB CŨ
        if (!isActive && tab.groupId) {
          // ✅ FIX QUAN TRỌNG: Đảm bảo group được set active TRƯỚC KHI tạo tab
          await new Promise<void>((resolve, reject) => {
            chrome.runtime.sendMessage(
              {
                action: "setActiveGroup",
                groupId: tab.groupId,
              },
              () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }
                resolve();
              }
            );
          });

          // Đợi đủ lâu để tab manager xử lý ẩn/hiện tab
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // ✅ BƯỚC 3: TẠO TAB THẬT Ở VỊ TRÍ PHÙ HỢP
        const createTabOptions: any = {
          url: tab.url || undefined,
          active: true,
        };

        if (tab.cookieStoreId && tab.cookieStoreId !== "firefox-default") {
          createTabOptions.cookieStoreId = tab.cookieStoreId;
        }

        // Thêm index để chỉ định vị trí tạo tab
        // Sử dụng metadata tab position để tạo tab ở vị trí tương ứng
        createTabOptions.index = tabIndex; // ĐÃ SỬA: props.tabIndex -> tabIndex

        // Sử dụng message để tạo tab ở vị trí cụ thể
        const newTab = await new Promise<chrome.tabs.Tab>((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: "createTabInGroupAtPosition",
              groupId: tab.groupId,
              url: tab.url || undefined,
              position: tabIndex, // ĐÃ SỬA: props.tabIndex -> tabIndex
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              if (!response) {
                reject(new Error("No response from background script"));
                return;
              }
              if (response.error) {
                reject(new Error(response.error));
                return;
              }
              resolve(response);
            }
          );
        });

        // ✅ BƯỚC 4: GÁN TAB VÀO GROUP
        if (newTab.id && tab.groupId) {
          await new Promise<void>((resolve, reject) => {
            chrome.runtime.sendMessage(
              {
                action: "assignTabToGroup",
                tabId: newTab.id,
                groupId: tab.groupId,
                position: tabIndex, // THÊM POSITION
              },
              () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }
                resolve();
              }
            );
          });
        }

        // ✅ BƯỚC 5: FOCUS VÀO TAB MỚI
        await new Promise<void>((resolve) => {
          chrome.tabs.update(newTab.id!, { active: true }, () => {
            if (chrome.runtime.lastError) {
              console.error(
                "[TabItem] ❌ Failed to activate:",
                chrome.runtime.lastError
              );
            }
            resolve();
          });
        });

        // ✅ BƯỚC 6: REFRESH LẠI HIỂN THỊ GROUP ĐỂ ĐẢM BẢO ẨN TAB CŨ
        if (tab.groupId) {
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
              {
                action: "refreshActiveGroupDisplay",
                groupId: tab.groupId,
              },
              () => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "[TabItem] ❌ Failed to refresh group display:",
                    chrome.runtime.lastError
                  );
                }
                resolve();
              }
            );
          });
        }

        if (newTab.windowId) {
          await new Promise<void>((resolve) => {
            chrome.windows.update(newTab.windowId!, { focused: true }, () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[TabItem] ❌ Failed to focus window:",
                  chrome.runtime.lastError
                );
              }
              resolve();
            });
          });
        }

        console.groupEnd();
      } catch (error) {
        console.error("[TabItem] ❌ CRITICAL ERROR:", error);
        console.groupEnd();
        alert(
          `Failed to open tab: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      return;
    }

    // ✅ TRƯỜNG HỢP 2: Tab đã có ID (tab thực tế)
    if (tab.id) {
      try {
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
          console.groupEnd();
          alert(
            `Tab "${tab.title}" không tồn tại.\n\nCó thể đã bị đóng hoặc là dữ liệu từ backup.\n\nHãy tạo lại tab bằng cách click "Add New Tab" trong group.`
          );
          return;
        }

        if (!isActive && tab.groupId) {
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage(
              {
                action: "setActiveGroup",
                groupId: tab.groupId,
              },
              () => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "[TabItem] ❌ setActiveGroup failed:",
                    chrome.runtime.lastError
                  );
                }
                resolve();
              }
            );
          });

          await new Promise((resolve) => setTimeout(resolve, 200));
          await new Promise<void>((resolve) => {
            chrome.tabs.update(tab.id!, { active: true }, () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[TabItem] ❌ Failed to activate:",
                  chrome.runtime.lastError
                );
              }
              resolve();
            });
          });

          if (tab.windowId) {
            await new Promise<void>((resolve) => {
              chrome.windows.update(tab.windowId!, { focused: true }, () => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "[TabItem] ❌ Failed to focus window:",
                    chrome.runtime.lastError
                  );
                }
                resolve();
              });
            });
          }
        } else {
          await new Promise<void>((resolve) => {
            chrome.tabs.update(tab.id!, { active: true }, () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[TabItem] ❌ Failed to activate:",
                  chrome.runtime.lastError
                );
              }
              resolve();
            });
          });

          await new Promise<void>((resolve) => {
            chrome.windows.update(tab.windowId!, { focused: true }, () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[TabItem] ❌ Failed to focus window:",
                  chrome.runtime.lastError
                );
              }
              resolve();
            });
          });
        }

        console.groupEnd();
      } catch (error) {
        console.error("[TabItem] ❌ ERROR:", error);
        console.groupEnd();
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

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // TRƯỜNG HỢP 1: Tab có ID (tab thực tế)
    if (tab.id) {
      onClose(tab.id);
      return;
    }

    // TRƯỜNG HỢP 2: Tab không có ID (metadata tab)
    // Xóa metadata tab khỏi group
    if (!tab.id && tab.url && tab.title && tab.groupId) {
      try {
        await new Promise<void>((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: "removeMetadataTabAtPosition",
              groupId: tab.groupId,
              tabUrl: tab.url,
              tabTitle: tab.title,
              position: tabIndex,
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[TabItem] ❌ Failed to remove metadata:",
                  chrome.runtime.lastError
                );
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              console.log("[TabItem] ✅ Metadata tab removed successfully");
              resolve();
            }
          );
        });
      } catch (error) {
        console.error("[TabItem] ❌ Failed to remove metadata tab:", error);
        alert("Failed to remove tab. Please try again.");
      }
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
          <div
            className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full ${
              isContainerTab && containerColor
                ? getContainerBgColor(containerColor)
                : "bg-primary"
            }`}
          />
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
              isTabActive && isContainerTab && containerColor
                ? `${getContainerTextColor(containerColor)} font-medium`
                : isTabActive
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
          {/* Badge cho tab metadata */}
          {!tab.id && <span className="text-xs px-1.5 py-0.5">👻</span>}

          {shouldShowBadge && <span className="text-xs px-1 py-1">📦</span>}
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
