// File: src/presentation/components/sidebar/GroupCard.tsx
import React, { useState, useEffect } from "react";
import { MoreVertical, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { TabGroup } from "@/types/tab-group";
import TabItem from "./TabItem";
import CustomDropdown from "../common/CustomDropdown";
import SelectProxyModal from "../proxy/SelectProxyModal";
import { ProxyManager } from "@/shared/lib/proxy-manager";

interface GroupCardProps {
  group: TabGroup;
  isActive: boolean;
  onEdit: (group: TabGroup) => void;
  onDelete: (groupId: string) => void;
  onSetActive: (groupId: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  isActive,
  onEdit,
  onDelete,
  onSetActive,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreatingTab, setIsCreatingTab] = useState(false);
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [groupProxyId, setGroupProxyId] = useState<string | null>(null);
  const [hasTabProxies, setHasTabProxies] = useState(false);

  useEffect(() => {
    loadGroupProxy();
  }, [group.id, group.tabs]);

  const loadGroupProxy = async () => {
    const proxyId = await ProxyManager.getGroupProxy(group.id);
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
    {
      value: "add-proxy",
      label: "Proxy",
      icon: "🌐",
      disabled: hasTabProxies,
    },
    {
      value: "sleep",
      label: "Sleep All Tabs",
      icon: "💤",
    },
    {
      value: "delete",
      label: "Delete Group",
      icon: "🗑️",
      danger: true,
    },
  ];

  const handleDropdownSelect = (value: string) => {
    setShowDropdown(false);

    switch (value) {
      case "edit":
        onEdit(group);
        break;
      case "add-tab":
        handleAddTab();
        break;
      case "add-proxy":
        if (!hasTabProxies) {
          setShowProxyModal(true);
        }
        break;
      case "sleep":
        handleSleepAllTabs();
        break;
      case "delete":
        if (confirm(`Are you sure you want to delete "${group.name}"?`)) {
          onDelete(group.id);
        }
        break;
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
      console.log(`[GroupCard] Slept all tabs in group: ${group.name}`);
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

      // Notify background script to apply proxy
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
        onClick={() => onSetActive(group.id)}
      >
        {/* Expand/Collapse Icon */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-0.5 hover:bg-button-secondBgHover rounded"
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

          <div className="relative z-50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="p-1 hover:bg-button-secondBgHover rounded"
            >
              <MoreVertical className="w-3.5 h-3.5 text-text-secondary" />
            </button>

            {showDropdown && (
              <div className="absolute top-full right-0 mt-1 z-[9999]">
                <CustomDropdown
                  options={dropdownOptions}
                  onSelect={handleDropdownSelect}
                  align="right"
                  width="w-44"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab List */}
      {isExpanded && (
        <div className="ml-5">
          {group.tabs.map((tab) => {
            const isTabActive = tab.active || false;
            return (
              <TabItem
                key={tab.id}
                tab={tab}
                onClose={handleTabClosed}
                currentGroupId={group.id}
                isActive={isActive}
                isTabActive={isTabActive}
                groupType={group.type}
                groupHasProxy={!!groupProxyId}
                onProxyChanged={loadGroupProxy}
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
      <SelectProxyModal
        isOpen={showProxyModal}
        onClose={() => setShowProxyModal(false)}
        onProxySelected={handleProxySelected}
        currentProxyId={groupProxyId || undefined}
        targetType="group"
      />
    </div>
  );
};

export default GroupCard;
