// File: /home/khanhromvn/Documents/Coding/Orbit/src/presentation/components/sidebar/Sidebar.tsx

import React, { useState, useEffect, useMemo } from "react";
import { Settings } from "lucide-react";
import GroupCard from "./GroupCard";
import GroupDrawer from "./GroupDrawer";
import ThemeDrawer from "../common/ThemeDrawer";
import SettingDrawer from "./SettingDrawer";
import BackupDrawer from "./BackupDrawer";
import SortGroupDrawer from "./SortGroupDrawer"; // Add this import
import SidebarHeader from "./SidebarHeader";
import CustomButton from "../common/CustomButton";
import { TabGroup, GroupModalState } from "../../../types/tab-group";
import { getBrowserAPI } from "@/shared/lib/browser-api";
import RestoreDrawer from "./RestoreDrawer";

const Sidebar: React.FC = () => {
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [modalState, setModalState] = useState<GroupModalState>({
    isOpen: false,
    mode: "create",
  });
  const [showThemeDrawer, setShowThemeDrawer] = useState(false);
  const [showSettingDrawer, setShowSettingDrawer] = useState(false);
  const [showBackupDrawer, setShowBackupDrawer] = useState(false);
  const [showSortDrawer, setShowSortDrawer] = useState(false);
  const [showRestoreDrawer, setShowRestoreDrawer] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    const initializeSidebar = async () => {
      // ✅ BƯỚC 1: Kiểm tra session backup TRƯỚC
      await checkAndShowRestore();

      // ✅ BƯỚC 2: Load groups bình thường
      await loadGroups();
      await loadActiveGroup();
      await loadExpandedGroups();
    };

    initializeSidebar();

    const messageListener = (message: any) => {
      if (message.action === "groupsUpdated") {
        setGroups(message.groups || []);
        setActiveGroupId(message.activeGroupId || null);
      }
    };

    const browserAPI = getBrowserAPI();
    browserAPI.runtime.onMessage.addListener(messageListener);

    return () => {
      browserAPI.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const checkAndShowRestore = async () => {
    console.debug("[Sidebar] 🔍 Checking for session backup...");

    try {
      const response = await new Promise<{
        exists: boolean;
        timestamp: number | null;
        groupCount: number;
        tabCount: number;
        source: "indexedDB" | "localStorage" | null;
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "getSessionInfo",
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "[Sidebar] Runtime error:",
                chrome.runtime.lastError
              );
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(response);
          }
        );
      });

      console.debug("[Sidebar] 📥 Session info:", {
        exists: response.exists,
        source: response.source,
        groupCount: response.groupCount,
        tabCount: response.tabCount,
      });

      // ✅ THAY ĐỔI: Hiển thị RestoreDrawer nếu có session (từ bất kỳ nguồn nào)
      if (response.exists) {
        console.debug("[Sidebar] ✅ Session found, showing RestoreDrawer");
        setShowRestoreDrawer(true);
      } else {
        console.debug("[Sidebar] ℹ️ No session found, starting fresh");
      }
    } catch (error) {
      console.error("[Sidebar] ❌ Failed to check restore:", error);
    }
  };

  const loadExpandedGroups = async () => {
    try {
      const browserAPI = getBrowserAPI();
      const result = await browserAPI.storage.local.get(["expandedGroupIds"]);
      const expandedIds = result.expandedGroupIds || [];
      setExpandedGroups(new Set(expandedIds));
    } catch (error) {
      console.error("Failed to load expanded groups:", error);
    }
  };

  const saveExpandedGroups = async (groupIds: Set<string>) => {
    try {
      const browserAPI = getBrowserAPI();
      await browserAPI.storage.local.set({
        expandedGroupIds: Array.from(groupIds),
      });
    } catch (error) {
      console.error("Failed to save expanded groups:", error);
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      saveExpandedGroups(newSet);
      return newSet;
    });
  };

  const loadGroups = async () => {
    try {
      const browserAPI = getBrowserAPI();
      const result = await browserAPI.storage.local.get(["tabGroups"]);

      setGroups(result?.tabGroups || []);
    } catch (error) {
      console.error("[Sidebar] ❌ Failed to load groups:", error);
    }
  };

  const loadActiveGroup = async () => {
    try {
      const browserAPI = getBrowserAPI();
      const result = await browserAPI.storage.local.get(["activeGroupId"]);
      setActiveGroupId(result?.activeGroupId || null);
    } catch (error) {
      console.error("Failed to load active group:", error);
    }
  };

  const handleCreateGroup = () => {
    setModalState({
      isOpen: true,
      mode: "create",
    });
  };

  const handleEditGroup = (group: TabGroup) => {
    setModalState({
      isOpen: true,
      mode: "edit",
      group,
    });
  };

  const handleGroupCreated = () => {
    setModalState({ isOpen: false, mode: "create" });
  };

  const handleGroupUpdated = () => {
    setModalState({ isOpen: false, mode: "create" });
  };

  const handleGroupDeleted = async (groupId: string) => {
    try {
      const browserAPI = getBrowserAPI();
      await browserAPI.runtime.sendMessage({
        action: "deleteGroup",
        groupId: groupId,
      });

      if (activeGroupId === groupId) {
        const newActiveGroup = groups.find((g) => g.id !== groupId);
        setActiveGroupId(newActiveGroup?.id || null);
      }

      await loadGroups();
    } catch (error) {
      console.error("[Sidebar] ❌ Failed to delete group:", error);
      alert("Failed to delete group. Please try again.");
    }
  };

  const handleSetActiveGroup = async (groupId: string) => {
    setActiveGroupId(groupId);

    try {
      const browserAPI = getBrowserAPI();

      await browserAPI.runtime.sendMessage({
        action: "setActiveGroup",
        groupId,
      });
    } catch (error) {
      console.error("[Sidebar] ❌ Failed to set active group:", error);
    }
  };

  // Filter groups based on search value
  const filteredGroups = useMemo(() => {
    if (!searchValue.trim()) return groups;

    const searchLower = searchValue.toLowerCase();
    return groups.filter((group) =>
      group.name.toLowerCase().includes(searchLower)
    );
  }, [groups, searchValue]);

  return (
    <div className="w-full h-screen overflow-hidden bg-background relative">
      {/* Main content */}
      <div className="flex flex-col h-full">
        {/* Search Header */}
        <SidebarHeader
          isSearching={isSearching}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onCloseSearch={() => {
            setIsSearching(false);
            setSearchValue("");
          }}
        />

        <div className="flex-1 overflow-y-auto">
          {filteredGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              isActive={group.id === activeGroupId}
              isExpanded={expandedGroups.has(group.id)}
              onToggleExpand={toggleGroupExpand}
              onEdit={handleEditGroup}
              onDelete={handleGroupDeleted}
              onSetActive={handleSetActiveGroup}
            />
          ))}
          {filteredGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center mb-4">
                <span className="text-3xl">{searchValue ? "🔍" : "📚"}</span>
              </div>
              <p className="text-text-secondary text-sm">
                {searchValue ? "No groups found" : "No groups yet"}
              </p>
              <p className="text-text-secondary/70 text-xs mt-1">
                {searchValue
                  ? "Try a different search term"
                  : "Create your first group to get started!"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button - Bottom Right */}
      <div className="fixed bottom-2 right-2 z-40">
        <CustomButton
          variant="ghost"
          size="sm"
          icon={Settings}
          onClick={() => setShowSettingDrawer(!showSettingDrawer)}
          aria-label="Open settings menu"
          className="!p-3 !text-lg"
          children={undefined}
        ></CustomButton>
      </div>

      {/* Setting Drawer */}
      <SettingDrawer
        isOpen={showSettingDrawer}
        onClose={() => setShowSettingDrawer(false)}
        onAddGroup={handleCreateGroup}
        onTheme={() => setShowThemeDrawer(true)}
        onSearch={() => setIsSearching(true)}
        onBackup={() => setShowBackupDrawer(true)}
        onSortGroups={() => setShowSortDrawer(true)} // Add this prop
      />

      {/* Modals & Drawers */}
      <GroupDrawer
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        group={modalState.group}
        onClose={() => setModalState({ isOpen: false, mode: "create" })}
        onGroupCreated={handleGroupCreated}
        onGroupUpdated={handleGroupUpdated}
      />

      <ThemeDrawer
        isOpen={showThemeDrawer}
        onClose={() => setShowThemeDrawer(false)}
      />

      <BackupDrawer
        isOpen={showBackupDrawer}
        onClose={() => setShowBackupDrawer(false)}
      />

      {/* Add SortGroupDrawer */}
      <SortGroupDrawer
        isOpen={showSortDrawer}
        onClose={() => setShowSortDrawer(false)}
      />

      {/* Restore Drawer */}
      <RestoreDrawer
        isOpen={showRestoreDrawer}
        onRestore={async () => {
          console.debug("[Sidebar] 🔄 Restoring session...");
          try {
            await chrome.runtime.sendMessage({
              action: "restoreSession",
            });
            console.debug("[Sidebar] ✅ Session restored, reloading UI...");
            setShowRestoreDrawer(false);
            setTimeout(() => {
              window.location.reload();
            }, 500);
          } catch (error) {
            console.error("[Sidebar] ❌ Restore failed:", error);
            alert("Failed to restore session. Please try again.");
          }
        }}
        onCancel={async () => {
          console.debug("[Sidebar] ❌ User cancelled restore");
          setShowRestoreDrawer(false);
          // Session đã được clear trong RestoreDrawer
        }}
      />
    </div>
  );
};

export default Sidebar;
