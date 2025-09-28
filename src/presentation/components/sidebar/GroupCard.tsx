import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Edit2,
  Trash2,
  MessageSquare,
  Folder,
  FolderOpen,
  MoreVertical,
  Focus,
} from "lucide-react";
import TabItem from "./TabItem";
import CustomDropdown, { DropdownOption } from "../common/CustomDropdown";

interface ClaudeTab {
  id: number;
  title: string;
  url: string;
  active: boolean;
  container: string;
  containerName: string;
  containerColor: string;
  containerIcon: string;
}

interface TabGroup {
  id: string;
  name: string;
  type: "container" | "custom";
  containerCookieStoreId?: string;
  tabs: ClaudeTab[];
  expanded: boolean;
  color?: string;
  icon?: string;
  created: number;
  lastModified: number;
}

interface Container {
  cookieStoreId: string;
  name: string;
  color: string;
  icon: string;
}

interface GroupCardProps {
  group: TabGroup;
  containers: Container[];
  viewMode: "compact" | "normal" | "detailed";
  isFocused?: boolean;
  onFocusGroup?: (groupId: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<TabGroup>) => void;
  onDeleteGroup: (groupId: string) => void;
  onCreateTabInGroup: (
    groupId: string,
    containerCookieStoreId?: string
  ) => void;
  onFocusTab: (tabId: number) => void;
  onCloseTab: (tabId: number) => void;
  onRemoveTabFromGroup: (tabId: number, groupId: string) => void;
  onRequestConfirmClose: (tabId: number, tabTitle: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  onUpdateGroup,
  onDeleteGroup,
  onCreateTabInGroup,
  onFocusTab,
  onCloseTab,
  onRemoveTabFromGroup,
  onRequestConfirmClose,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(group.name);

  const isContainer = group.type === "container";
  const containerColor = group.color || "gray";
  const containerIcon = group.icon || "default";
  const activeTabs = group.tabs.filter((tab) => tab.active).length;
  const totalTabs = group.tabs.length;

  const dropdownOptions: DropdownOption[] = [
    {
      value: "add-tab",
      label: "Add New Tab",
      icon: <Plus size={14} />,
    },
    {
      value: "toggle",
      label: group.expanded ? "Collapse" : "Expand",
      icon: group.expanded ? (
        <ChevronUp size={14} />
      ) : (
        <ChevronDown size={14} />
      ),
    },
    ...(group.type === "custom"
      ? [
          {
            value: "rename",
            label: "Rename Group",
            icon: <Edit2 size={14} />,
          },
        ]
      : []),
    {
      value: "delete",
      label: "Delete Group",
      icon: <Trash2 size={14} />,
      danger: true,
    },
  ];

  const handleDropdownSelect = (value: string) => {
    setShowDropdown(false);

    switch (value) {
      case "add-tab":
        onCreateTabInGroup(group.id, group.containerCookieStoreId);
        break;
      case "toggle":
        onUpdateGroup(group.id, { expanded: !group.expanded });
        break;
      case "rename":
        setEditingName(true);
        break;
      case "delete":
        onDeleteGroup(group.id);
        break;
    }
  };

  const handleSaveName = () => {
    if (newName.trim() && newName.trim() !== group.name) {
      onUpdateGroup(group.id, { name: newName.trim() });
    }
    setEditingName(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setNewName(group.name);
      setEditingName(false);
    }
  };

  const getContainerIcon = (icon: string) => {
    const iconMap: Record<string, string> = {
      fingerprint: "🔒",
      briefcase: "💼",
      dollar: "💰",
      cart: "🛒",
      circle: "⭕",
      gift: "🎁",
      vacation: "🏖️",
      food: "🍕",
      fruit: "🍎",
      pet: "🐾",
      tree: "🌳",
      chill: "😎",
    };
    return iconMap[icon] || "📁";
  };

  const getContainerColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-500",
      red: "bg-red-500",
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      orange: "bg-orange-500",
      purple: "bg-purple-500",
      pink: "bg-pink-500",
      gray: "bg-gray-500",
    };
    return colorMap[color] || "bg-blue-500";
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-all">
      {/* Single Row Layout */}
      <div className="flex items-center justify-between gap-3">
        {/* Left Section: Icon + Name + Badges */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Expand/Collapse Button */}
          <button
            onClick={() =>
              onUpdateGroup(group.id, { expanded: !group.expanded })
            }
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex-shrink-0"
            title={group.expanded ? "Collapse group" : "Expand group"}
          >
            {group.expanded ? (
              <ChevronDown
                size={14}
                className="text-gray-600 dark:text-gray-400"
              />
            ) : (
              <ChevronRight
                size={14}
                className="text-gray-600 dark:text-gray-400"
              />
            )}
          </button>

          {/* Group Icon & Type Badge */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isContainer ? (
              <div className="flex items-center gap-1">
                <div
                  className={`w-2 h-2 rounded-full ${getContainerColorClass(
                    containerColor
                  )}`}
                />
                <span className="text-sm">
                  {getContainerIcon(containerIcon)}
                </span>
              </div>
            ) : group.expanded ? (
              <FolderOpen
                size={16}
                className="text-gray-600 dark:text-gray-400"
              />
            ) : (
              <Folder size={16} className="text-gray-600 dark:text-gray-400" />
            )}

            {/* Type Badge */}
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                isContainer
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              }`}
            >
              {isContainer ? "Container" : "Custom"}
            </span>
          </div>

          {/* Group Name */}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={handleKeyPress}
                className="text-sm font-medium bg-transparent border-b border-blue-500 dark:border-blue-400 focus:outline-none w-full text-gray-900 dark:text-gray-100"
                autoFocus
                maxLength={30}
              />
            ) : (
              <h3
                className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={() => !isContainer && setEditingName(true)}
                title={group.name}
              >
                {group.name}
              </h3>
            )}
          </div>

          {/* Tab Status Badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Total Tabs */}
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-full">
              {totalTabs} tab{totalTabs !== 1 ? "s" : ""}
            </span>

            {/* Active Tabs */}
            {activeTabs > 0 && (
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full flex items-center gap-1">
                <Focus size={10} />
                {activeTabs} active
              </span>
            )}
          </div>
        </div>

        {/* Right Section: Menu Button */}
        <div className="flex-shrink-0 relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Group menu"
          >
            <MoreVertical
              size={16}
              className="text-gray-600 dark:text-gray-400"
            />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 z-50">
              <CustomDropdown
                options={dropdownOptions}
                onSelect={handleDropdownSelect}
                align="right"
                width="w-48"
                className="shadow-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content - Tabs List */}
      {group.expanded && (
        <div className="mt-3 pl-6 space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
          {totalTabs === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
              <MessageSquare size={20} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tabs in this group</p>
              <p className="text-xs mt-1">
                {isContainer
                  ? "Click the menu button to add a new Claude tab"
                  : "Drag tabs here or use the menu to add tabs"}
              </p>
            </div>
          ) : (
            group.tabs
              .sort((a, b) => {
                // Active tabs first
                if (a.active && !b.active) return -1;
                if (!a.active && b.active) return 1;
                // Then by title
                return a.title.localeCompare(b.title);
              })
              .map((tab) => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  group={group}
                  containerColor={containerColor}
                  onFocus={() => onFocusTab(tab.id)}
                  onClose={() => onCloseTab(tab.id)}
                  onRequestConfirmClose={onRequestConfirmClose}
                  onRemoveFromGroup={
                    group.type === "custom"
                      ? () => onRemoveTabFromGroup(tab.id, group.id)
                      : undefined
                  }
                />
              ))
          )}
        </div>
      )}
    </div>
  );
};

export default GroupCard;
