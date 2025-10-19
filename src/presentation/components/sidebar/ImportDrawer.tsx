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
import { TabGroup } from "../../../types/tab-group";
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

      // ✅ BƯỚC 1: LOAD DỮ LIỆU HIỆN TẠI
      const currentStorage = await browserAPI.storage.local.get([
        "tabGroups",
        "activeGroupId",
        "orbit-proxies",
        "orbit-proxy-assignments",
      ]);

      const currentGroups: TabGroup[] = currentStorage.tabGroups || [];
      const currentProxies = currentStorage["orbit-proxies"] || [];
      const currentAssignments =
        currentStorage["orbit-proxy-assignments"] || [];

      // ✅ BƯỚC 2: XỬ LÝ MERGE GROUPS VÀ TABS
      const selectedGroups = backupData.tabGroups
        .filter((group) => {
          const groupSelection = selection[group.id];
          return (
            groupSelection.selected ||
            Object.values(groupSelection.tabs).some((selected) => selected)
          );
        })
        .map((group) => {
          const groupSelection = selection[group.id];

          const selectedTabs = group.tabs.filter((tab) => {
            const tabKey = `${tab.url}-${tab.title}`;
            const isSelected = groupSelection.tabs[tabKey];

            if (
              tab.url &&
              restrictedUrlPrefixes.some((prefix) =>
                tab.url!.startsWith(prefix)
              )
            ) {
              return false;
            }

            return isSelected;
          });

          const processedTabs = selectedTabs.map((tab) => {
            const isRestrictedUrl = restrictedUrlPrefixes.some((prefix) =>
              (tab.url || "").startsWith(prefix)
            );

            return {
              ...tab,
              isRestrictedUrl,
            };
          });

          return {
            ...group,
            tabs: processedTabs,
          };
        });

      if (selectedGroups.length === 0) {
        setError("Please select at least one group to import");
        setIsImporting(false);
        return;
      }

      // ✅ BƯỚC 3: MERGE GROUPS - Tìm group tồn tại hoặc tạo mới
      const mergedGroups: TabGroup[] = [];

      for (const backupGroup of selectedGroups) {
        // Tìm group hiện có theo ID hoặc NAME + TYPE
        let existingGroup = currentGroups.find(
          (g) =>
            g.id === backupGroup.id ||
            (g.name === backupGroup.name && g.type === backupGroup.type)
        );

        if (existingGroup) {
          // Lọc các tab mới (chưa tồn tại trong group)
          const existingTabKeys = new Set(
            existingGroup.tabs.map((t) => `${t.url}-${t.title}`)
          );

          const newTabs = backupGroup.tabs.filter((tab) => {
            const tabKey = `${tab.url}-${tab.title}`;
            return !existingTabKeys.has(tabKey);
          });

          // Thêm tabs mới vào group hiện có
          existingGroup.tabs.push(...newTabs);

          mergedGroups.push(existingGroup);
        } else {
          try {
            const newGroup = await browserAPI.runtime.sendMessage({
              action: "createGroup",
              groupData: {
                name: backupGroup.name,
                type: backupGroup.type,
                color: backupGroup.color || "#3B82F6",
                icon: backupGroup.icon || "📦",
                visible: backupGroup.visible !== false,
                containerId: backupGroup.containerId,
              },
            });

            if (!newGroup || !newGroup.id) {
              throw new Error(`Failed to create group: ${backupGroup.name}`);
            }

            // Lưu group mới với tabs từ backup
            newGroup.tabs = backupGroup.tabs;
            mergedGroups.push(newGroup);

            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            console.error(
              `[ImportDrawer] ❌ Failed to create group "${backupGroup.name}":`,
              error
            );
          }
        }
      }

      if (mergedGroups.length === 0) {
        throw new Error("Failed to process any groups");
      }

      // ✅ BƯỚC 4: LƯU GROUPS ĐÃ MERGE VÀO STORAGE
      const finalGroups = currentGroups.map((g) => {
        const merged = mergedGroups.find((mg) => mg.id === g.id);
        return merged || g;
      });

      // Thêm các group mới (chưa có trong currentGroups)
      const newGroupIds = new Set(currentGroups.map((g) => g.id));
      const brandNewGroups = mergedGroups.filter((g) => !newGroupIds.has(g.id));
      finalGroups.push(...brandNewGroups);

      await browserAPI.storage.local.set({
        tabGroups: finalGroups,
      });

      // ✅ BƯỚC 4.5: RECONCILE TABS - Đối chiếu metadata với tabs thực tế
      const allBrowserTabs = await browserAPI.tabs.query({});

      for (const group of finalGroups) {
        for (const tab of group.tabs) {
          // Nếu tab chưa có id (metadata từ backup), tìm tab thực tế match
          if (!tab.id && tab.url) {
            const matchingTab = allBrowserTabs.find((browserTab: any) => {
              // Match theo URL và cookieStoreId
              const urlMatch = browserTab.url === tab.url;
              const containerMatch =
                browserTab.cookieStoreId === tab.cookieStoreId;
              return urlMatch && containerMatch;
            });

            if (matchingTab) {
              // Gán tab.id từ browser tab
              tab.id = matchingTab.id;
              tab.windowId = matchingTab.windowId;
            }
          }
        }
      }

      // Lưu lại groups sau khi reconcile
      await browserAPI.storage.local.set({
        tabGroups: finalGroups,
      });

      // ✅ BƯỚC 5: LƯU METADATA TABS (KHÔNG TẠO TABS THỰC TẾ)
      // ✅ XỬ LÝ: Loại bỏ tab.id để đảm bảo tabs sẽ được lazy-create khi click
      for (const group of mergedGroups) {
        group.tabs = group.tabs.map((tab) => {
          // Nếu tab đã có id (tab hiện có), giữ nguyên
          if (tab.id) {
            return tab;
          }

          // Nếu tab chưa có id (tab từ backup), loại bỏ id và giữ metadata
          return {
            title: tab.title || "New Tab",
            url: tab.url || "",
            favIconUrl: tab.favIconUrl || null,
            cookieStoreId: tab.cookieStoreId || "firefox-default",
            groupId: group.id,
            // Không có id => tab sẽ được tạo khi user click (lazy creation)
          };
        });
      }

      // ✅ BƯỚC 6: LƯU GROUPS VỚI METADATA TABS VÀO STORAGE
      const updatedGroups = finalGroups.map((g) => {
        const merged = mergedGroups.find((mg) => mg.id === g.id);
        return merged || g;
      });

      await browserAPI.storage.local.set({
        tabGroups: updatedGroups,
      });

      // ✅ BƯỚC 7: MERGE PROXIES (nếu có)
      if (backupData.proxies && backupData.proxies.length > 0) {
        const existingProxyIds = new Set(currentProxies.map((p: any) => p.id));
        const newProxies = backupData.proxies.filter(
          (p: any) => !existingProxyIds.has(p.id)
        );

        const mergedProxies = [...currentProxies, ...newProxies];

        await browserAPI.storage.local.set({
          "orbit-proxies": mergedProxies,
        });
      }

      // ✅ BƯỚC 6: MERGE PROXY ASSIGNMENTS (nếu có)
      if (backupData.assignments && backupData.assignments.length > 0) {
        const existingAssignmentKeys = new Set(
          currentAssignments.map(
            (a: any) => `${a.proxyId}-${a.tabId || a.groupId}`
          )
        );

        const newAssignments = backupData.assignments.filter((a: any) => {
          const key = `${a.proxyId}-${a.tabId || a.groupId}`;
          return !existingAssignmentKeys.has(key);
        });

        const mergedAssignments = [...currentAssignments, ...newAssignments];

        await browserAPI.storage.local.set({
          "orbit-proxy-assignments": mergedAssignments,
        });
      }

      // ✅ BƯỚC 7: RELOAD BACKGROUND SCRIPT
      try {
        await browserAPI.runtime.sendMessage({
          action: "reloadAfterImport",
        });
      } catch (messageError) {
        console.warn("[ImportDrawer] ⚠️ Failed to send reload:", messageError);
      }

      onClose();

      // ✅ Reload UI
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("[ImportDrawer] ❌ Import failed:", error);
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
            Import & Merge
          </CustomButton>
        </>
      }
    >
      <div className="h-full overflow-y-auto bg-drawer-background">
        {/* ℹ️ INFO BANNER */}
        {backupData && (
          <div className="mx-4 mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400 rounded-lg space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-full font-bold text-sm">
                ℹ
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2">
                  Merge Import Mode
                </h4>
                <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                  Importing will <strong>merge</strong> backup data with your
                  current groups and tabs. Existing data will be preserved.
                </p>
              </div>
            </div>
          </div>
        )}

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
