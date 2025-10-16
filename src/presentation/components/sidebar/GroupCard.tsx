// File: /home/khanhromvn/Documents/Coding/Orbit/src/presentation/components/sidebar/GroupCard.tsx

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { TabGroup } from "@/types/tab-group";
import TabItem from "./TabItem";
import CustomDropdown from "../common/CustomDropdown";
import SelectProxyDrawer from "./SelectProxyDrawer";
import { ProxyManager } from "@/shared/lib/proxy-manager";

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

  useEffect(() => {
    loadGroupProxy();
  }, [group.id, group.tabs]);

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
    {
      value: "delete",
      label: "Delete Group",
      icon: "🗑️",
      danger: true,
    },
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

  const handleProxySelected = async (proxyId: string) => {
    try {
      if (proxyId) {
        await ProxyManager.assignProxyToGroup(group.id, proxyId);
      } else {
        await ProxyManager.removeGroupProxy(group.id);
      }
      await loadGroupProxy();

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
          cursor-pointer rounded-lg transition-all duration-150
        `}
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
            isActive ? "text-primary" : "text-text-secondary"
          }`}
        >
          {group.tabs.length}
        </div>

        {/* Group Name */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span
            className={`text-sm truncate transition-colors ${
              isActive ? "text-primary font-medium" : "text-text-primary"
            }`}
          >
            {group.name}
          </span>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1 flex-shrink-0 group-hover:mr-0 mr-auto">
          {group.type === "container" && (
            <span className="text-xs text-primary px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30">
              C
            </span>
          )}
          {groupProxyId && (
            <span className="text-xs text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30">
              P
            </span>
          )}
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
