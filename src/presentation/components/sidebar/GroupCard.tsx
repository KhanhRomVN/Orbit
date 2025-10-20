import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { TabGroup } from "../../../types/tab-group";
import TabItem from "./TabItem";
import CustomDropdown from "../common/CustomDropdown";
import SelectProxyDrawer from "./SelectProxyDrawer";
import { ProxyManager } from "@/shared/lib/proxy-manager";
import { getBrowserAPI } from "@/shared/lib/browser-api";

interface GroupCardProps {
  group: TabGroup;
  isActive: boolean;
  isExpanded: boolean;
  onToggleExpand: (groupId: string) => void;
  onEdit: (group: TabGroup) => void;
  onDelete: (groupId: string) => void;
  onSetActive: (groupId: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  isActive,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onSetActive,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreatingTab, setIsCreatingTab] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [groupProxyId, setGroupProxyId] = useState<string | null>(null);
  const [hasTabProxies, setHasTabProxies] = useState(false);
  const [containerColor, setContainerColor] = useState<string | null>(null);

  const getContainerGradientColor = (color: string | null): string => {
    if (!color) return "59, 130, 246"; // primary color RGB

    const gradientMap: { [key: string]: string } = {
      blue: "37, 99, 235",
      turquoise: "8, 145, 178",
      green: "22, 163, 74",
      yellow: "234, 179, 8",
      orange: "249, 115, 22",
      red: "220, 38, 38",
      pink: "236, 72, 153",
      purple: "168, 85, 247",
      toolbar: "107, 114, 128",
    };

    return gradientMap[color] || "59, 130, 246";
  };

  const getContainerBorderColor = (color: string | null): string => {
    if (!color) return "border-primary";

    const borderMap: { [key: string]: string } = {
      blue: "border-blue-600 dark:border-blue-400",
      turquoise: "border-cyan-600 dark:border-cyan-400",
      green: "border-green-600 dark:border-green-400",
      yellow: "border-yellow-600 dark:border-yellow-400",
      orange: "border-orange-600 dark:border-orange-400",
      red: "border-red-600 dark:border-red-400",
      pink: "border-pink-600 dark:border-pink-400",
      purple: "border-purple-600 dark:border-purple-400",
      toolbar: "border-gray-600 dark:border-gray-400",
    };

    return borderMap[color] || "border-primary";
  };

  useEffect(() => {
    loadGroupProxy();
    loadContainerColor();

    // ✅ Listen for proxy assignment changes
    const handleMessage = (message: any) => {
      if (
        message.action === "proxyAssignmentChanged" &&
        message.groupId === group.id
      ) {
        loadGroupProxy();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [group.id, group.tabs, group.containerId]);

  // Calculate dropdown position
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 176;

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

  const loadContainerColor = async () => {
    if (group.type === "container" && group.containerId) {
      try {
        const browserAPI = getBrowserAPI();
        if (browserAPI.contextualIdentities) {
          const containers = await browserAPI.contextualIdentities.query({});
          const container = containers.find(
            (c) => c.cookieStoreId === group.containerId
          );
          setContainerColor(container?.color || null);
        }
      } catch (error) {
        console.error("[GroupCard] Failed to load container color:", error);
        setContainerColor(null);
      }
    } else {
      setContainerColor(null);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(group.id);
  };

  const loadGroupProxy = async () => {
    let proxyId: string | null = null;
    if (group.type === "container" && group.containerId) {
      proxyId = await ProxyManager.getContainerProxy(group.containerId);
    }
    setGroupProxyId(proxyId);

    const tabIds = group.tabs.map((t) => t.id).filter(Boolean) as number[];
    const hasProxies = await ProxyManager.groupHasTabProxies(group.id, tabIds);
    setHasTabProxies(hasProxies);
  };

  const dropdownOptions = [
    {
      value: "edit",
      label: "Edit Group",
      icon: "✏️",
    },
    {
      value: "add-tab",
      label: "Add New Tab",
      icon: "➕",
    },
    ...(group.type === "container"
      ? [
          {
            value: "add-proxy",
            label: "Proxy",
            icon: "🌐",
            disabled: hasTabProxies,
          },
        ]
      : []),
    ...(!isActive
      ? [
          {
            value: "sleep",
            label: "Sleep All Tabs",
            icon: "💤",
          },
        ]
      : []),
    ...(!isActive
      ? [
          {
            value: "delete",
            label: "Delete Group",
            icon: "🗑️",
            danger: true,
          },
        ]
      : []),
  ];

  const handleDropdownSelect = (value: string) => {
    switch (value) {
      case "edit":
        setShowDropdown(false);
        onEdit(group);
        break;

      case "add-tab":
        setShowDropdown(false);
        handleAddTab();
        break;

      case "add-proxy":
        if (group.type === "container" && !hasTabProxies) {
          setShowDropdown(false);
          setShowProxyModal(true);
        } else {
          setShowDropdown(false);
        }
        break;

      case "sleep":
        setShowDropdown(false);
        handleSleepAllTabs();
        break;

      case "delete":
        setShowDropdown(false);
        onDelete(group.id);
        break;

      default:
        setShowDropdown(false);
    }
  };

  const handleAddTab = async () => {
    if (isCreatingTab) return;

    setIsCreatingTab(true);
    try {
      await chrome.runtime.sendMessage({
        action: "createTabInGroup",
        groupId: group.id,
      });
    } catch (error) {
      console.error("Failed to create tab:", error);
    } finally {
      setTimeout(() => setIsCreatingTab(false), 500);
    }
  };

  const handleSleepAllTabs = async () => {
    try {
      for (const tab of group.tabs) {
        if (tab.id && !tab.active) {
          await chrome.tabs.discard(tab.id);
        }
      }
    } catch (error) {
      console.error("Failed to sleep tabs:", error);
    }
  };

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

  const handleProxySelected = async (proxyId: string) => {
    try {
      if (proxyId) {
        await ProxyManager.assignProxyToGroup(group.id, proxyId);
      } else {
        await ProxyManager.removeGroupProxy(group.id);
      }

      // ✅ CRITICAL: Reload proxy status TRƯỚC KHI đóng drawer
      await loadGroupProxy();

      // ✅ Broadcast để các GroupCard khác cũng reload
      chrome.runtime
        .sendMessage({
          action: "proxyAssignmentChanged",
          groupId: group.id,
        })
        .catch(() => {
          // No receivers, that's fine
        });

      chrome.runtime.sendMessage({
        action: "applyGroupProxy",
        groupId: group.id,
        proxyId: proxyId || null,
      });
    } catch (error) {
      console.error("Failed to apply proxy:", error);
    }
  };

  const handleTabClosed = async (tabId: number) => {
    try {
      await chrome.tabs.remove(tabId);
    } catch (error) {
      console.error("Failed to close tab:", error);
    }
  };

  return (
    <div className="select-none">
      {/* Group Header */}
      <div
        className={`
          group flex items-center gap-2 px-2 py-2 
          cursor-pointer transition-all duration-150 relative
          ${
            isActive
              ? `border-l-2 ${
                  group.type === "container" && containerColor
                    ? getContainerBorderColor(containerColor)
                    : "border-primary"
                }`
              : ""
          }
        `}
        style={
          isActive
            ? {
                background: `linear-gradient(to left, 
                  rgba(${
                    group.type === "container" && containerColor
                      ? getContainerGradientColor(containerColor)
                      : "59, 130, 246"
                  }, 0.12) 0%, 
                  rgba(${
                    group.type === "container" && containerColor
                      ? getContainerGradientColor(containerColor)
                      : "59, 130, 246"
                  }, 0.06) 40%, 
                  transparent 80%)`,
              }
            : undefined
        }
        onClick={() => {
          onSetActive(group.id);
        }}
      >
        {/* Expand/Collapse Icon */}
        <button
          onClick={handleToggleExpand}
          className="p-0.5 hover:bg-button-secondBgHover rounded cursor-pointer"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          )}
        </button>

        <div
          className={`w-5 h-5 flex items-center justify-center text-xs font-semibold rounded-md transition-all duration-150 bg-button-secondBg ${
            group.type === "container" && containerColor
              ? getContainerTextColor(containerColor)
              : "text-text-primary"
          }`}
        >
          {group.tabs.length}
        </div>

        {/* Group Name */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span
            className={`text-base truncate transition-colors ${
              group.type === "container" && containerColor
                ? `${getContainerTextColor(containerColor)} font-medium`
                : "text-text-primary"
            }`}
          >
            {group.name}
          </span>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1 flex-shrink-0 group-hover:mr-0 mr-auto">
          {groupProxyId && <span className="text-xs px-1.5 py-0.5">🌐</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 group-hover:w-auto w-0 overflow-hidden">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddTab();
            }}
            className="p-1 hover:bg-button-secondBgHover rounded"
            title="Add New Tab"
          >
            <Plus className="w-3.5 h-3.5 text-text-secondary" />
          </button>

          <div className="relative">
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
      </div>

      {/* Tab List */}
      {isExpanded && (
        <div className="ml-5">
          {group.tabs.map((tab, index) => {
            const isTabActive = tab.active || false;
            return (
              <TabItem
                key={tab.id || `${tab.url}-${tab.title}`}
                tab={tab}
                onClose={handleTabClosed}
                currentGroupId={group.id}
                isActive={isActive}
                isTabActive={isTabActive}
                groupType={group.type}
                groupHasProxy={!!groupProxyId}
                onProxyChanged={loadGroupProxy}
                tabIndex={index}
              />
            );
          })}

          {group.tabs.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-text-secondary italic">
              No tabs
            </div>
          )}
        </div>
      )}

      {/* Proxy Selection Modal */}
      <SelectProxyDrawer
        isOpen={showProxyModal}
        onClose={() => setShowProxyModal(false)}
        onProxySelected={handleProxySelected}
        currentProxyId={groupProxyId || undefined}
        targetType="group"
      />

      {/* Dropdown Menu */}
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
              width="w-44"
            />
          </div>,
          document.body
        )}
    </div>
  );
};

export default GroupCard;
