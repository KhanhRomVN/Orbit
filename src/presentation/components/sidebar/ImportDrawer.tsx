import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  MinusSquare,
  FileJson,
} from "lucide-react";
import MotionCustomDrawer from "../common/CustomDrawer";
import CustomButton from "../common/CustomButton";
import { TabGroup } from "@/types/tab-group";
import { getBrowserAPI } from "@/shared/lib/browser-api";

interface ImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BackupData {
  version: string;
  timestamp: string;
  tabGroups: TabGroup[];
  activeGroupId: string | null;
  proxies?: any[];
  assignments?: any[];
}

interface SelectionState {
  [groupId: string]: {
    selected: boolean;
    tabs: { [tabUrl: string]: boolean };
  };
}

const ImportDrawer: React.FC<ImportDrawerProps> = ({ isOpen, onClose }) => {
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [selection, setSelection] = useState<SelectionState>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  const handleFileSelect = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) return;

      setError("");
      setFileName(file.name);

      try {
        const text = await file.text();
        const data: BackupData = JSON.parse(text);

        // Validate backup data
        if (!data.version || !data.tabGroups) {
          throw new Error("Invalid backup file format");
        }

        setBackupData(data);

        // Initialize selection state (all selected by default)
        const initialSelection: SelectionState = {};
        data.tabGroups.forEach((group) => {
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
        setExpandedGroups(new Set(data.tabGroups.map((g) => g.id)));
      } catch (error) {
        console.error("[ImportDrawer] Failed to parse file:", error);
        setError("Invalid backup file. Please check the file format.");
        setBackupData(null);
        setFileName("");
      }
    };

    input.click();
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
    if (!backupData) return;

    const newSelection: SelectionState = {};
    backupData.tabGroups.forEach((group) => {
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
    if (!backupData) return;

    const newSelection: SelectionState = {};
    backupData.tabGroups.forEach((group) => {
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

  const handleImport = async () => {
    if (!backupData) return;

    setIsImporting(true);
    setError("");

    try {
      const browserAPI = getBrowserAPI();

      // Filter selected groups and tabs
      const selectedGroups = backupData.tabGroups
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
        setError("Please select at least one group or tab to import");
        setIsImporting(false);
        return;
      }

      // Get existing groups
      const existingResult = await browserAPI.storage.local.get(["tabGroups"]);
      const existingGroups = existingResult.tabGroups || [];

      // Merge with existing groups
      const mergedGroups = [...existingGroups, ...selectedGroups];

      // Save to storage
      await browserAPI.storage.local.set({
        tabGroups: mergedGroups,
      });

      // Import proxies if any
      if (backupData.proxies && backupData.proxies.length > 0) {
        const existingProxiesResult = await browserAPI.storage.local.get([
          "orbit-proxies",
        ]);
        const existingProxies = existingProxiesResult["orbit-proxies"] || [];
        const mergedProxies = [...existingProxies, ...backupData.proxies];
        await browserAPI.storage.local.set({
          "orbit-proxies": mergedProxies,
        });
      }

      // Import proxy assignments if any
      if (backupData.assignments && backupData.assignments.length > 0) {
        const existingAssignmentsResult = await browserAPI.storage.local.get([
          "orbit-proxy-assignments",
        ]);
        const existingAssignments =
          existingAssignmentsResult["orbit-proxy-assignments"] || [];
        const mergedAssignments = [
          ...existingAssignments,
          ...backupData.assignments,
        ];
        await browserAPI.storage.local.set({
          "orbit-proxy-assignments": mergedAssignments,
        });
      }

      console.log("[ImportDrawer] 💾 Data imported successfully");

      // Notify background script to reload
      try {
        await browserAPI.runtime.sendMessage({
          action: "reloadAfterImport",
        });
        console.log("[ImportDrawer] 📨 Reload message sent to background");
      } catch (messageError) {
        console.warn(
          "[ImportDrawer] ⚠️ Failed to send reload message:",
          messageError
        );
      }

      onClose();

      // Reload page to show new data
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("[ImportDrawer] Import failed:", error);
      setError("Failed to import. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  const selectedCount = backupData
    ? Object.values(selection).reduce((count, groupSel) => {
        return count + Object.values(groupSel.tabs).filter((sel) => sel).length;
      }, 0)
    : 0;

  const drawerContent = (
    <MotionCustomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Import Groups & Tabs"
      subtitle={
        backupData
          ? `${selectedCount} tab(s) selected from ${fileName}`
          : "No file selected"
      }
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
            icon={Upload}
            onClick={handleImport}
            disabled={!backupData || selectedCount === 0 || isImporting}
            loading={isImporting}
          >
            Import Selected
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

        {!backupData ? (
          /* File Selection */
          <div className="p-4">
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border-default rounded-lg">
              <FileJson className="w-12 h-12 text-text-secondary mb-4" />
              <p className="text-sm text-text-secondary mb-4">
                Select a backup file to import
              </p>
              <CustomButton
                variant="primary"
                size="md"
                icon={Upload}
                onClick={handleFileSelect}
              >
                Choose File
              </CustomButton>
            </div>
          </div>
        ) : (
          /* Tree View */
          <>
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
                <CustomButton
                  variant="secondary"
                  size="sm"
                  onClick={handleFileSelect}
                  icon={FileJson}
                >
                  Change File
                </CustomButton>
              </div>
            </div>

            {/* Groups Tree */}
            <div className="p-4 space-y-2">
              {backupData.tabGroups.map((group) => {
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
                                onClick={() =>
                                  toggleTabSelection(group.id, tabKey)
                                }
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
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = "none";
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

              {backupData.tabGroups.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-text-secondary">
                    No groups in backup file
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MotionCustomDrawer>
  );

  return isOpen ? createPortal(drawerContent, document.body) : null;
};

export default ImportDrawer;
