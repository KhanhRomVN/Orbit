import React, { useState, useMemo, useEffect } from "react";
import { MessageSquare, Search, Filter, X, Folder } from "lucide-react";
import GroupCard from "./GroupCard";

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

interface GroupListProps {
  groups: TabGroup[];
  containers: Container[];
  isLoading: boolean;
  viewMode?: "compact" | "normal" | "detailed";
  onFocusTab: (tabId: number) => void;
  onCloseTab: (tabId: number) => void;
  onUpdateGroup: (groupId: string, updates: Partial<TabGroup>) => void;
  onDeleteGroup: (groupId: string) => void;
  onCreateTabInGroup: (
    groupId: string,
    containerCookieStoreId?: string
  ) => void;
  onAddTabToGroup: (tabId: number, groupId: string) => void;
  onRemoveTabFromGroup: (tabId: number, groupId: string) => void;
  focusedGroupId?: string | null;
  onFocusGroup?: (groupId: string) => void;
}

interface ConfirmDialog {
  isOpen: boolean;
  type: "delete-group" | "close-tab";
  title: string;
  message: string;
  groupId?: string;
  groupName?: string;
  tabId?: number;
  tabTitle?: string;
}

const GroupList: React.FC<GroupListProps> = ({
  groups,
  containers,
  isLoading,
  viewMode = "normal",
  onFocusTab,
  onCloseTab,
  onUpdateGroup,
  onDeleteGroup,
  onCreateTabInGroup,
  onRemoveTabFromGroup,
  focusedGroupId,
  onFocusGroup,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModal, setFilterModal] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    showContainer: true,
    showCustom: true,
    showEmpty: true,
    showWithTabs: true,
  });

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    isOpen: false,
    type: "delete-group",
    title: "",
    message: "",
  });

  const [internalFocusedGroup, setInternalFocusedGroup] = useState<
    string | null
  >(null);

  // Determine current focused group (external prop takes priority)
  const currentFocusedGroup = focusedGroupId || internalFocusedGroup;

  // Filter groups based on search and filters
  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      // Search filter
      if (
        searchQuery &&
        !group.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Type filter
      if (group.type === "container" && !activeFilters.showContainer)
        return false;
      if (group.type === "custom" && !activeFilters.showCustom) return false;

      // Tab count filter
      if (group.tabs.length === 0 && !activeFilters.showEmpty) return false;
      if (group.tabs.length > 0 && !activeFilters.showWithTabs) return false;

      return true;
    });
  }, [groups, searchQuery, activeFilters]);

  // Ensure one group is always focused: default to first group when none selected
  useEffect(() => {
    if (!currentFocusedGroup && filteredGroups.length > 0) {
      setInternalFocusedGroup(filteredGroups[0].id);
    }
  }, [filteredGroups, currentFocusedGroup]);

  // Determine which groups to display based on focus
  const displayedGroups = currentFocusedGroup
    ? filteredGroups.filter((g) => g.id === currentFocusedGroup)
    : filteredGroups;

  // Handler để xử lý confirm delete group
  const handleConfirmAction = () => {
    if (confirmDialog.type === "delete-group" && confirmDialog.groupId) {
      onDeleteGroup(confirmDialog.groupId);
    } else if (confirmDialog.type === "close-tab" && confirmDialog.tabId) {
      onCloseTab(confirmDialog.tabId);
    }

    setConfirmDialog({
      isOpen: false,
      type: "delete-group",
      title: "",
      message: "",
    });
  };

  const handleCancelAction = () => {
    setConfirmDialog({
      isOpen: false,
      type: "delete-group",
      title: "",
      message: "",
    });
  };

  // Handler để focus group
  const handleFocusGroup = (groupId: string) => {
    if (onFocusGroup) {
      onFocusGroup(groupId);
    } else {
      setInternalFocusedGroup(groupId);
    }
  };

  // Handler để request confirm close tab
  const handleRequestConfirmClose = (tabId: number, tabTitle: string) => {
    setConfirmDialog({
      isOpen: true,
      type: "close-tab",
      title: "Xác nhận đóng tab",
      message: `Bạn có chắc muốn đóng tab "${tabTitle}"?`,
      tabId,
      tabTitle,
    });
  };

  // Auto-create tab for empty groups when focused
  const handleGroupFocus = async (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    // Set focused group
    handleFocusGroup(groupId);

    // Auto-create tab for empty group
    if (group.tabs.length === 0) {
      try {
        await onCreateTabInGroup(groupId, group.containerCookieStoreId);
      } catch (error) {
        console.error("Error auto-creating tab for empty group:", error);
      }
    }

    // Force expand group when focused
    if (!group.expanded) {
      onUpdateGroup(groupId, { expanded: true });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
          <p>Loading groups and tabs...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Search and Filter Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setFilterModal(true)}
            className="p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            title="Filter groups"
          >
            <Filter size={16} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || !Object.values(activeFilters).every((v) => v)) && (
          <div className="flex items-center gap-2 mt-3">
            {searchQuery && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                Search: "{searchQuery}"
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {filteredGroups.length} of {groups.length} groups
            </span>
          </div>
        )}
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {displayedGroups.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            {searchQuery ? (
              <>
                <Search size={48} className="mx-auto mb-4 opacity-30" />
                <p>No groups match your search</p>
                <p className="text-sm mt-1">Try adjusting your search terms</p>
              </>
            ) : (
              <>
                <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
                <p>No groups available</p>
                <p className="text-sm mt-1">Create a group to get started</p>
              </>
            )}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              containers={containers}
              viewMode={viewMode}
              isFocused={currentFocusedGroup === group.id}
              onFocusGroup={handleGroupFocus}
              onUpdateGroup={onUpdateGroup}
              onDeleteGroup={onDeleteGroup}
              onCreateTabInGroup={onCreateTabInGroup}
              onFocusTab={onFocusTab}
              onCloseTab={onCloseTab}
              onRemoveTabFromGroup={onRemoveTabFromGroup}
              onRequestConfirmClose={handleRequestConfirmClose}
            />
          ))
        )}
      </div>

      {/* Filter Modal */}
      {filterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Filter Groups
              </h3>
              <button
                onClick={() => setFilterModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Close filter"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Group Types
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeFilters.showContainer}
                      onChange={(e) =>
                        setActiveFilters((prev) => ({
                          ...prev,
                          showContainer: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      Container Groups
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeFilters.showCustom}
                      onChange={(e) =>
                        setActiveFilters((prev) => ({
                          ...prev,
                          showCustom: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Folder size={12} className="text-purple-600" />
                      Custom Groups
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Tab Status
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeFilters.showWithTabs}
                      onChange={(e) =>
                        setActiveFilters((prev) => ({
                          ...prev,
                          showWithTabs: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Groups with tabs
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeFilters.showEmpty}
                      onChange={(e) =>
                        setActiveFilters((prev) => ({
                          ...prev,
                          showEmpty: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Empty groups
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() =>
                    setActiveFilters({
                      showContainer: true,
                      showCustom: true,
                      showEmpty: true,
                      showWithTabs: true,
                    })
                  }
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Reset All
                </button>
                <button
                  onClick={() => setFilterModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {confirmDialog.title}
            </h3>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {confirmDialog.message}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelAction}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${
                  confirmDialog.type === "delete-group"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-orange-600 hover:bg-orange-700"
                }`}
              >
                {confirmDialog.type === "delete-group" ? "Xóa" : "Đóng tab"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GroupList;
