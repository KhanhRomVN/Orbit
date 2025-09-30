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
    // Prevent double-click
    if (isCreatingTab) {
      console.debug("[GroupCard] Already creating tab, ignoring");
      return;
    }

    setIsCreatingTab(true);
    try {
      console.debug("[GroupCard] Creating tab for group:", group.id);
      await chrome.runtime.sendMessage({
        action: "createTabInGroup",
        groupId: group.id,
      });
      console.debug("[GroupCard] Tab creation request sent");
    } catch (error) {
      console.error("Failed to create tab:", error);
    } finally {
      // Reset sau 500ms để cho phép tạo tab tiếp theo
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

  const handleTabMoved = async (tabId: number, newGroupId: string) => {
    try {
      await chrome.runtime.sendMessage({
        action: "assignTabToGroup",
        tabId,
        groupId: newGroupId,
      });
    } catch (error) {
      console.error("Failed to move tab:", error);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border ${
        isActive
          ? "border-blue-500 shadow-md"
          : "border-gray-200 dark:border-gray-700"
      } transition-all`}
    >
      {/* Group Header */}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center space-x-3 flex-1 cursor-pointer"
            onClick={() => onSetActive(group.id)}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: group.color }}
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {group.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {group.tabs.length}
            </span>
            {group.type === "container" && (
              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                Container
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={handleAddTab}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Add New Tab"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showDropdown && (
                <CustomDropdown
                  options={dropdownOptions}
                  onSelect={handleDropdownSelect}
                  align="right"
                  width="w-36"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab List */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {group.tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              onClose={handleTabClosed}
              onMove={handleTabMoved}
              currentGroupId={group.id}
            />
          ))}

          {group.tabs.length === 0 && (
            <div className="p-3 text-center text-gray-500 dark:text-gray-400 text-sm">
              No tabs in this group
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupCard;
