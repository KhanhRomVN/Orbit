// File: src/presentation/components/sidebar/Sidebar.tsx
import React, { useState, useEffect, useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Settings } from "lucide-react";
import GroupCard from "./GroupCard";
import GroupDrawer from "./GroupDrawer";
import ThemeDrawer from "../common/ThemeDrawer";
import SettingDrawer from "./SettingDrawer";
import SidebarHeader from "./SidebarHeader";
import CustomButton from "../common/CustomButton";
import { TabGroup, GroupModalState } from "@/types/tab-group";
import { getBrowserAPI } from "@/shared/lib/browser-api";

const Sidebar: React.FC = () => {
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<GroupModalState>({
    isOpen: false,
    mode: "create",
  });
  const [showThemeDrawer, setShowThemeDrawer] = useState(false);
  const [showSettingDrawer, setShowSettingDrawer] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    const initializeSidebar = async () => {
      await loadGroups();
      await loadActiveGroup();
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

  const loadGroups = async () => {
    try {
      const browserAPI = getBrowserAPI();
      const result = await browserAPI.storage.local.get(["tabGroups"]);
      setGroups(result?.tabGroups || []);
    } catch (error) {
      console.error("Failed to load groups:", error);
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

  const handleGroupDeleted = (groupId: string) => {
    if (activeGroupId === groupId) {
      setActiveGroupId(groups.find((g) => g.id !== groupId)?.id || null);
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

  const handleReorderGroups = (draggedId: string, targetId: string) => {
    const draggedIndex = groups.findIndex((g) => g.id === draggedId);
    const targetIndex = groups.findIndex((g) => g.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Create new array with reordered groups
    const newGroups = [...groups];
    const [draggedGroup] = newGroups.splice(draggedIndex, 1);
    newGroups.splice(targetIndex, 0, draggedGroup);

    setGroups(newGroups);

    // Save to storage
    const browserAPI = getBrowserAPI();
    browserAPI.storage.local.set({ tabGroups: newGroups }).catch((error) => {
      console.error("[Sidebar] Failed to save group order:", error);
    });
  };

  return (
    <DndProvider backend={HTML5Backend}>
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
                onEdit={handleEditGroup}
                onDelete={handleGroupDeleted}
                onSetActive={handleSetActiveGroup}
                onReorderGroups={handleReorderGroups}
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
        <div className="fixed bottom-6 right-6 z-40">
          <CustomButton
            variant="primary"
            size="sm"
            icon={Settings}
            onClick={() => setShowSettingDrawer(!showSettingDrawer)}
            aria-label="Open settings menu"
            className="!p-3 !text-lg"
          >
            <span className="sr-only">Open settings menu</span>
          </CustomButton>
        </div>

        {/* Setting Drawer */}
        <SettingDrawer
          isOpen={showSettingDrawer}
          onClose={() => setShowSettingDrawer(false)}
          onAddGroup={handleCreateGroup}
          onTheme={() => setShowThemeDrawer(true)}
          onSearch={() => setIsSearching(true)}
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
      </div>
    </DndProvider>
  );
};

export default Sidebar;
