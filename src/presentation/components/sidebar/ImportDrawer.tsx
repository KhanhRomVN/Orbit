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
  const [confirmDelete, setConfirmDelete] = useState(false);

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

        // ✅ DEBUG: Log nội dung file backup
        console.log("[ImportDrawer] 📄 Backup file loaded:", {
          version: data.version,
          timestamp: data.timestamp,
          totalGroups: data.tabGroups.length,
          activeGroupId: data.activeGroupId,
          groups: data.tabGroups.map((g) => ({
            id: g.id,
            name: g.name,
            type: g.type,
            tabCount: g.tabs.length,
            tabs: g.tabs.map((t) => ({
              title: t.title,
              url: t.url,
              cookieStoreId: t.cookieStoreId,
            })),
          })),
          proxies: data.proxies?.length || 0,
          assignments: data.assignments?.length || 0,
        });

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

    if (!confirmDelete) {
      setError(
        "Please confirm that you understand all current data will be deleted"
      );
      return;
    }

    setIsImporting(true);
    setError("");

    try {
      const browserAPI = getBrowserAPI();

      console.log("[ImportDrawer] 🔄 Starting import process...");

      // ✅ BƯỚC 1: XÓA TOÀN BỘ TABS THẬT HIỆN TẠI
      try {
        const allTabs = await browserAPI.tabs.query({});
        console.log(`[ImportDrawer] 🗑️ Closing ${allTabs.length} tabs...`);

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

        for (const tab of allTabs) {
          if (!tab.id) continue;

          const isRestricted = restrictedUrlPrefixes.some((prefix) =>
            (tab.url || "").startsWith(prefix)
          );

          if (!isRestricted) {
            try {
              await browserAPI.tabs.remove(tab.id);
              console.log(`[ImportDrawer] ✅ Closed tab:`, {
                id: tab.id,
                url: tab.url,
              });
            } catch (error) {
              console.warn(
                `[ImportDrawer] ⚠️ Failed to close tab ${tab.id}:`,
                error
              );
            }
          } else {
            console.log(`[ImportDrawer] ⏭️ Skipped restricted tab:`, {
              id: tab.id,
              url: tab.url,
            });
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error("[ImportDrawer] ❌ Failed to close tabs:", error);
      }

      // ✅ BƯỚC 2: XÓA DỮ LIỆU STORAGE
      await browserAPI.storage.local.set({
        tabGroups: [],
        activeGroupId: null,
        "orbit-proxies": [],
        "orbit-proxy-assignments": [],
      });

      console.log("[ImportDrawer] 🗑️ Storage data deleted");

      // ✅ BƯỚC 3: XỬ LÝ GROUPS VÀ TABS TỪ BACKUP
      console.log("[ImportDrawer] 📋 Processing backup groups...");

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

          // ✅ LẤY TẤT CẢ TABS ĐÃ CHỌN - KHÔNG FILTER GÌ CẢ
          const selectedTabs = group.tabs.filter((tab) => {
            const tabKey = `${tab.url}-${tab.title}`;
            return groupSelection.tabs[tabKey];
          });

          // ✅ GIỮ NGUYÊN TẤT CẢ THÔNG TIN TAB - CHỈ THÊM FLAG isRestrictedUrl
          const processedTabs = selectedTabs.map((tab) => {
            const isRestrictedUrl = restrictedUrlPrefixes.some((prefix) =>
              (tab.url || "").startsWith(prefix)
            );

            return {
              ...tab, // ✅ GIỮ NGUYÊN TẤT CẢ PROPERTIES GỐC
              isRestrictedUrl, // ✅ Thêm flag để xử lý khi tạo tab
            };
          });

          console.log(`[ImportDrawer] 📑 Group "${group.name}":`, {
            totalTabs: processedTabs.length,
            restrictedTabs: processedTabs.filter((t) => t.isRestrictedUrl)
              .length,
            normalTabs: processedTabs.filter((t) => !t.isRestrictedUrl).length,
            emptyGroups: processedTabs.length === 0 ? 1 : 0,
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

      // ✅ BƯỚC 4: TẠO MỚI TẤT CẢ GROUPS
      console.log("[ImportDrawer] 🔨 Creating new groups...");

      const createdGroups: any[] = [];

      // Tạo tất cả groups trước
      for (let i = 0; i < selectedGroups.length; i++) {
        const group = selectedGroups[i];

        console.log(
          `[ImportDrawer] 📦 Creating group ${i + 1}/${
            selectedGroups.length
          }: ${group.name}`
        );

        try {
          // ✅ TẠO GROUP MỚI qua background script
          const newGroup = await browserAPI.runtime.sendMessage({
            action: "createGroup",
            groupData: {
              name: group.name,
              type: group.type,
              color: group.color || "#3B82F6",
              icon: group.icon || "📦",
              visible: group.visible !== false,
              containerId: group.containerId,
            },
          });

          if (!newGroup || !newGroup.id) {
            throw new Error(`Failed to create group: ${group.name}`);
          }

          console.log(`[ImportDrawer] ✅ Group created:`, {
            id: newGroup.id,
            name: newGroup.name,
            type: newGroup.type,
            originalTabCount: group.tabs.length,
          });

          // Lưu group với thông tin tabs gốc
          createdGroups.push({
            ...newGroup,
            originalTabs: group.tabs, // Giữ lại tabs từ backup
          });

          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(
            `[ImportDrawer] ❌ Failed to create group "${group.name}":`,
            error
          );
        }
      }

      if (createdGroups.length === 0) {
        throw new Error("Failed to create any groups");
      }

      console.log("[ImportDrawer] 📊 Groups created:", {
        total: createdGroups.length,
        groups: createdGroups.map((g) => ({
          id: g.id,
          name: g.name,
          tabCount: g.originalTabs.length,
        })),
      });

      // ✅ BƯỚC 5: TẠO TABS CHO TẤT CẢ GROUPS
      console.log("[ImportDrawer] 🔨 Creating tabs for all groups...");

      let firstTabId: number | null = null;

      for (let i = 0; i < createdGroups.length; i++) {
        const group = createdGroups[i];
        const tabs = group.originalTabs || [];
        const isFirstGroup = i === 0;

        if (tabs.length === 0) {
          console.log(
            `[ImportDrawer] ⏭️ Group "${group.name}" has no tabs, skipping...`
          );
          continue;
        }

        console.log(
          `[ImportDrawer] 🔨 Creating ${tabs.length} tabs for group "${group.name}"...`
        );

        for (let j = 0; j < tabs.length; j++) {
          const tab = tabs[j];
          const isFirstTab = isFirstGroup && j === 0;

          try {
            const createOptions: any = {
              active: false, // Tất cả tabs đều inactive ban đầu
            };

            // ✅ PHÂN LOẠI: Tabs đặc biệt vs Tabs bình thường
            const isEmptyOrNewTab =
              !tab.url || tab.url === "" || tab.title === "New Tab";
            const isAboutUrl = tab.url && tab.url.startsWith("about:");

            if (isEmptyOrNewTab || isAboutUrl) {
              // ✅ TABS ĐẶC BIỆT: Tạo bình thường (không sleep)
              if (isAboutUrl) {
                createOptions.url = tab.url;
                console.log(
                  `[ImportDrawer] ⚠️ Creating special tab (about:):`,
                  {
                    url: tab.url,
                    group: group.name,
                  }
                );
              } else {
                // New Tab hoặc empty: không set url → tạo blank tab
                console.log(`[ImportDrawer] ⚠️ Creating blank tab:`, {
                  title: tab.title,
                  group: group.name,
                });
              }
            } else {
              // ✅ TABS BÌNH THƯỜNG: Để ở trạng thái SLEEP (không set url)
              // Chỉ lưu metadata vào storage, không tạo tab thật ngay
              console.log(`[ImportDrawer] 💤 Preparing sleeping tab:`, {
                url: tab.url,
                group: group.name,
              });

              // Lưu metadata tab vào storage
              const metadataTab = {
                title: tab.title || "New Tab",
                url: tab.url || "",
                favIconUrl: tab.favIconUrl || null,
                cookieStoreId: tab.cookieStoreId || "firefox-default",
                groupId: group.id,
                active: false,
                discarded: true,
              };

              // Cập nhật storage
              const currentStorage = await browserAPI.storage.local.get([
                "tabGroups",
              ]);
              const currentGroups = currentStorage.tabGroups || [];
              const groupIndex = currentGroups.findIndex(
                (g: any) => g.id === group.id
              );

              if (groupIndex !== -1) {
                if (!currentGroups[groupIndex].tabs) {
                  currentGroups[groupIndex].tabs = [];
                }
                currentGroups[groupIndex].tabs.push(metadataTab);
                await browserAPI.storage.local.set({
                  tabGroups: currentGroups,
                });
              }

              continue; // ✅ Bỏ qua việc tạo tab thật
            }

            // Set container nếu có
            if (tab.cookieStoreId && tab.cookieStoreId !== "firefox-default") {
              createOptions.cookieStoreId = tab.cookieStoreId;
            }

            // ✅ TẠO TAB THẬT (chỉ cho tabs đặc biệt)
            const newTab = await browserAPI.tabs.create(createOptions);
            console.log(`[ImportDrawer] ✅ Tab created:`, {
              id: newTab.id,
              url: newTab.url,
              group: group.name,
            });

            // Lưu firstTabId
            if (isFirstTab) {
              firstTabId = newTab.id || null;
              console.log(`[ImportDrawer] 🎯 First tab ID saved:`, firstTabId);
            }

            // ✅ Gán tab vào group
            if (newTab.id) {
              await browserAPI.runtime.sendMessage({
                action: "assignTabToGroup",
                tabId: newTab.id,
                groupId: group.id,
              });
            }

            await new Promise((resolve) => setTimeout(resolve, 50));
          } catch (error) {
            console.error(`[ImportDrawer] ❌ Failed to create tab:`, {
              error,
              url: tab.url,
              group: group.name,
            });
          }
        }

        console.log(
          `[ImportDrawer] ✅ Finished creating tabs for group "${group.name}"`
        );
      }

      // ✅ Import proxies
      if (backupData.proxies && backupData.proxies.length > 0) {
        await browserAPI.storage.local.set({
          "orbit-proxies": backupData.proxies,
        });
        console.log(
          `[ImportDrawer] 💾 Imported ${backupData.proxies.length} proxies`
        );
      }

      // ✅ Import proxy assignments
      if (backupData.assignments && backupData.assignments.length > 0) {
        await browserAPI.storage.local.set({
          "orbit-proxy-assignments": backupData.assignments,
        });
        console.log(
          `[ImportDrawer] 💾 Imported ${backupData.assignments.length} proxy assignments`
        );
      }

      console.log("[ImportDrawer] 🎉 Import completed successfully");

      // ✅ BƯỚC 6: RELOAD BACKGROUND SCRIPT
      try {
        await browserAPI.runtime.sendMessage({
          action: "reloadAfterImport",
        });
        console.log("[ImportDrawer] 📨 Reload message sent");
      } catch (messageError) {
        console.warn("[ImportDrawer] ⚠️ Failed to send reload:", messageError);
      }

      // ✅ BƯỚC 7: ACTIVATE GROUP ĐẦU TIÊN
      if (createdGroups[0]?.id) {
        try {
          await browserAPI.runtime.sendMessage({
            action: "setActiveGroup",
            groupId: createdGroups[0].id,
          });
          console.log(
            `[ImportDrawer] ✅ Activated group: ${createdGroups[0].name}`
          );
        } catch (error) {
          console.error("[ImportDrawer] ❌ Failed to activate group:", error);
        }
      }

      // ✅ BƯỚC 8: FOCUS VÀO TAB ĐẦU TIÊN
      if (firstTabId) {
        try {
          await browserAPI.tabs.update(firstTabId, { active: true });
          console.log(`[ImportDrawer] 🎯 Focused on first tab:`, firstTabId);

          const tab = await browserAPI.tabs.get(firstTabId);
          if (tab.windowId) {
            await browserAPI.windows.update(tab.windowId, { focused: true });
            console.log(`[ImportDrawer] 🪟 Focused window:`, tab.windowId);
          }
        } catch (error) {
          console.error("[ImportDrawer] ❌ Failed to focus tab:", error);
        }
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
            disabled={
              !backupData ||
              selectedCount === 0 ||
              isImporting ||
              !confirmDelete
            }
            loading={isImporting}
          >
            Import & Replace All
          </CustomButton>
        </>
      }
    >
      <div className="h-full overflow-y-auto bg-drawer-background">
        {/* ⚠️ WARNING BANNER */}
        {backupData && (
          <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-400 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full font-bold text-sm">
                !
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-red-700 dark:text-red-300 mb-2">
                  ⚠️ WARNING: ALL CURRENT DATA WILL BE DELETED
                </h4>
                <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                  Importing this backup will <strong>permanently delete</strong>{" "}
                  all your current groups, tabs, proxies, and settings. This
                  action cannot be undone.
                </p>
              </div>
            </div>

            {/* Checkbox xác nhận */}
            <div className="flex items-start gap-2 pt-2 border-t border-red-300 dark:border-red-700">
              <input
                type="checkbox"
                id="confirmDelete"
                checked={confirmDelete}
                onChange={(e) => {
                  setConfirmDelete(e.target.checked);
                  setError("");
                }}
                className="mt-0.5 w-4 h-4 text-red-600 bg-white border-red-300 rounded focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-red-600"
              />
              <label
                htmlFor="confirmDelete"
                className="text-xs text-red-700 dark:text-red-300 cursor-pointer select-none font-medium"
              >
                I understand that all my current data will be permanently
                deleted and replaced with this backup.
              </label>
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
