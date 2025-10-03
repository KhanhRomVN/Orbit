// File: src/presentation/components/sidebar/GroupCard.tsx
import React, { useState } from "react";
import { MoreVertical, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { TabGroup } from "@/types/tab-group";
import TabItem from "./TabItem";
import CustomDropdown from "../common/CustomDropdown";

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

  const handleTabClosed = async (tabId: number) => {
    try {
      await chrome.tabs.remove(tabId);
    } catch (error) {
      console.error("Failed to close tab:", error);
    }
  };

  return (
    <div className="select-none">
      {/* Group Header - Tree View Style */}
      <div
        className={`
    group
    flex items-center gap-2 px-3 py-2.5 
    cursor-pointer rounded-lg
    transition-all duration-150
    ${
      isActive
        ? "bg-sidebar-itemFocus shadow-sm border border-primary/20"
        : "hover:bg-sidebar-itemHover border border-transparent"
    }
  `}
        onClick={() => onSetActive(group.id)}
      >
        {/* Expand/Collapse Icon */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
        </button>

        {/* Folder Icon with Color */}
        <div
          className="w-6 h-6 flex items-center justify-center text-base rounded-md transition-transform group-hover:scale-110"
          style={{
            color: group.color,
            backgroundColor: `${group.color}15`,
          }}
        >
          {group.icon}
        </div>

        {/* Group Name and Tab Count */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span
            className={`text-sm truncate transition-colors ${
              isActive ? "text-text-primary font-medium" : "text-text-primary"
            }`}
          >
            {group.name}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "bg-gray-100 dark:bg-gray-700 text-text-secondary"
            }`}
          >
            {group.tabs.length}
          </span>
        </div>

        {/* Container Badge */}
        {group.type === "container" && (
          <span className="text-xs text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 flex-shrink-0">
            C
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddTab();
            }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="Add New Tab"
          >
            <Plus className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
          </button>

          <div className="relative z-50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <MoreVertical className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
            </button>

            {showDropdown && (
              <div className="absolute top-full right-0 mt-1 z-[9999]">
                <CustomDropdown
                  options={dropdownOptions}
                  onSelect={handleDropdownSelect}
                  align="right"
                  width="w-36"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab List - Indented Tree View */}
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
    </div>
  );
};

export default GroupCard;
