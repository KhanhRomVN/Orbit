import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  MinusSquare,
} from "lucide-react";
import MotionCustomDrawer from "../common/CustomDrawer";
import CustomButton from "../common/CustomButton";
import { TabGroup } from "@/types/tab-group";
import { getBrowserAPI } from "@/shared/lib/browser-api";

interface ExportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SelectionState {
  [groupId: string]: {
    selected: boolean;
    tabs: { [tabUrl: string]: boolean };
  };
}

const ExportDrawer: React.FC<ExportDrawerProps> = ({ isOpen, onClose }) => {
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [selection, setSelection] = useState<SelectionState>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadGroups();
    }
  }, [isOpen]);

  const loadGroups = async () => {
    try {
      const browserAPI = getBrowserAPI();
      const result = await browserAPI.storage.local.get(["tabGroups"]);
      const loadedGroups = result.tabGroups || [];
      setGroups(loadedGroups);

      // Initialize selection state (all selected by default)
      const initialSelection: SelectionState = {};
      loadedGroups.forEach((group: TabGroup) => {
        const tabSelection: { [key: string]: boolean } = {};
        group.tabs.forEach((tab) => {
          const tabKey = `${tab.url}-${tab.title}`;
          tabSelection[tabKey] = true;
        });
        initialSelection[group.id] = {
          selected: true,
          tabs: tabSelection,
        };
      });
      setSelection(initialSelection);

      // Expand all groups by default
      setExpandedGroups(new Set(loadedGroups.map((g: TabGroup) => g.id)));
    } catch (error) {
      console.error("[ExportDrawer] Failed to load groups:", error);
      setError("Failed to load groups");
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelection((prev) => {
      const newSelection = { ...prev };
      const currentSelection = newSelection[groupId];
      const newSelected = !currentSelection.selected;

      // Toggle all tabs in group
      const newTabs = { ...currentSelection.tabs };
      Object.keys(newTabs).forEach((tabKey) => {
        newTabs[tabKey] = newSelected;
      });

      newSelection[groupId] = {
        selected: newSelected,
        tabs: newTabs,
      };

      return newSelection;
    });
  };

  const toggleTabSelection = (groupId: string, tabKey: string) => {
    setSelection((prev) => {
      const newSelection = { ...prev };
      const groupSelection = newSelection[groupId];

      groupSelection.tabs[tabKey] = !groupSelection.tabs[tabKey];

      // Check if all tabs are selected
      const allTabsSelected = Object.values(groupSelection.tabs).every(
        (selected) => selected
      );
      const someTabsSelected = Object.values(groupSelection.tabs).some(
        (selected) => selected
      );

      groupSelection.selected = allTabsSelected || someTabsSelected;

      return newSelection;
    });
  };

  const selectAll = () => {
    const newSelection: SelectionState = {};
    groups.forEach((group) => {
      const tabSelection: { [key: string]: boolean } = {};
      group.tabs.forEach((tab) => {
        const tabKey = `${tab.url}-${tab.title}`;
        tabSelection[tabKey] = true;
      });
      newSelection[group.id] = {
        selected: true,
        tabs: tabSelection,
      };
    });
    setSelection(newSelection);
  };

  const deselectAll = () => {
    const newSelection: SelectionState = {};
    groups.forEach((group) => {
      const tabSelection: { [key: string]: boolean } = {};
      group.tabs.forEach((tab) => {
        const tabKey = `${tab.url}-${tab.title}`;
        tabSelection[tabKey] = false;
      });
      newSelection[group.id] = {
        selected: false,
        tabs: tabSelection,
      };
    });
    setSelection(newSelection);
  };

  const getGroupCheckboxState = (
    groupId: string
  ): "checked" | "unchecked" | "indeterminate" => {
    const groupSelection = selection[groupId];
    if (!groupSelection) return "unchecked";

    const tabStates = Object.values(groupSelection.tabs);
    const allSelected = tabStates.every((selected) => selected);
    const someSelected = tabStates.some((selected) => selected);

    if (allSelected) return "checked";
    if (someSelected) return "indeterminate";
    return "unchecked";
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError("");

    try {
      const browserAPI = getBrowserAPI();

      // Filter selected groups and tabs
      const selectedGroups = groups
        .filter((group) => {
          const groupSelection = selection[group.id];
          return Object.values(groupSelection.tabs).some(
            (selected) => selected
          );
        })
        .map((group) => {
          const groupSelection = selection[group.id];
          const selectedTabs = group.tabs.filter((tab) => {
            const tabKey = `${tab.url}-${tab.title}`;
            return groupSelection.tabs[tabKey];
          });

          // Sanitize tabs
          const restrictedUrlPrefixes = [
            "about:",
            "chrome:",
            "chrome-extension:",
            "moz-extension:",
            "edge:",
            "opera:",
            "brave:",
            "vivaldi:",
          ];

          const validTabs = selectedTabs
            .filter((tab) => {
              const url = tab.url || "";
              const isRestrictedUrl = restrictedUrlPrefixes.some((prefix) =>
                url.startsWith(prefix)
              );
              return !isRestrictedUrl && url.trim() !== "";
            })
            .map((tab) => ({
              title: tab.title || "New Tab",
              url: tab.url,
              favIconUrl: tab.favIconUrl || null,
              cookieStoreId: tab.cookieStoreId || "firefox-default",
              groupId: group.id,
            }));

          return {
            ...group,
            tabs: validTabs,
          };
        });

      if (selectedGroups.length === 0) {
        setError("Please select at least one group or tab to export");
        setIsExporting(false);
        return;
      }

      // Get additional data
      const result = await browserAPI.storage.local.get([
        "activeGroupId",
        "orbit-proxies",
        "orbit-proxy-assignments",
      ]);

      const backupData = {
        version: "1.0.1",
        timestamp: new Date().toISOString(),
        tabGroups: selectedGroups,
        activeGroupId: result.activeGroupId || null,
        proxies: result["orbit-proxies"] || [],
        assignments: result["orbit-proxy-assignments"] || [],
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `orbit-export-${
        new Date().toISOString().split("T")[0]
      }.json`;

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } catch (error) {
      console.error("[ExportDrawer] Export failed:", error);
      setError("Failed to export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const selectedCount = Object.values(selection).reduce((count, groupSel) => {
    return count + Object.values(groupSel.tabs).filter((sel) => sel).length;
  }, 0);

  const drawerContent = (
    <MotionCustomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Export Groups & Tabs"
      subtitle={`${selectedCount} tab(s) selected`}
      direction="right"
      size="full"
      animationType="slide"
      enableBlur={false}
      closeOnOverlayClick={true}
      showCloseButton={true}
      footerActions={
        <>
          <CustomButton variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton
            variant="primary"
            size="sm"
            icon={Download}
            onClick={handleExport}
            disabled={selectedCount === 0 || isExporting}
            loading={isExporting}
          >
            Export Selected
          </CustomButton>
        </>
      }
    >
      <div className="h-full overflow-y-auto bg-drawer-background">
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Selection Controls */}
        <div className="sticky top-0 z-10 bg-drawer-background border-b border-border-default px-4 py-3">
          <div className="flex items-center gap-2">
            <CustomButton
              variant="secondary"
              size="sm"
              onClick={selectAll}
              className="flex-1"
            >
              Select All
            </CustomButton>
            <CustomButton
              variant="secondary"
              size="sm"
              onClick={deselectAll}
              className="flex-1"
            >
              Deselect All
            </CustomButton>
          </div>
        </div>

        {/* Tree View */}
        <div className="p-4 space-y-2">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const checkboxState = getGroupCheckboxState(group.id);
            const selectedTabCount = Object.values(
              selection[group.id]?.tabs || {}
            ).filter((sel) => sel).length;

            return (
              <div key={group.id} className="space-y-1">
                {/* Group Row */}
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-itemHover transition-colors">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="p-1 hover:bg-button-secondBgHover rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-text-secondary" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-text-secondary" />
                    )}
                  </button>

                  <button
                    onClick={() => toggleGroupSelection(group.id)}
                    className="flex-shrink-0"
                  >
                    {checkboxState === "checked" ? (
                      <CheckSquare className="w-5 h-5 text-primary" />
                    ) : checkboxState === "indeterminate" ? (
                      <MinusSquare className="w-5 h-5 text-primary" />
                    ) : (
                      <Square className="w-5 h-5 text-text-secondary" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {group.name}
                      </span>
                      <span className="text-xs text-text-secondary">
                        ({selectedTabCount}/{group.tabs.length})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabs List */}
                {isExpanded && (
                  <div className="ml-8 space-y-1">
                    {group.tabs.map((tab) => {
                      const tabKey = `${tab.url}-${tab.title}`;
                      const isSelected =
                        selection[group.id]?.tabs[tabKey] || false;

                      return (
                        <div
                          key={tabKey}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-itemHover transition-colors"
                        >
                          <button
                            onClick={() => toggleTabSelection(group.id, tabKey)}
                            className="flex-shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-text-secondary" />
                            )}
                          </button>

                          {tab.favIconUrl && (
                            <img
                              src={tab.favIconUrl}
                              alt=""
                              className="w-4 h-4 flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          )}

                          <span className="text-sm text-text-primary truncate">
                            {tab.title || "New Tab"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {groups.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-text-secondary">No groups found</p>
            </div>
          )}
        </div>
      </div>
    </MotionCustomDrawer>
  );

  return isOpen ? createPortal(drawerContent, document.body) : null;
};

export default ExportDrawer;
