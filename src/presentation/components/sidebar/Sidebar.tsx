// File: src/presentation/components/sidebar/Sidebar.tsx
import React, { useState, useEffect } from "react";
import SidebarHeader from "./SidebarHeader";
import GroupCard from "./GroupCard";
import GroupModal from "./GroupModal";
import { TabGroup, GroupModalState } from "@/types/tab-group";
import { getBrowserAPI } from "@/shared/lib/browser-api";
import { useZoom } from "../../../shared/hooks/useZoom";

const Sidebar: React.FC = () => {
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<GroupModalState>({
    isOpen: false,
    mode: "create",
  });
  const { zoomLevel } = useZoom();

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
    // Update UI state immediately
    setActiveGroupId(groupId);

    try {
      const browserAPI = getBrowserAPI();

      await browserAPI.runtime.sendMessage({
        action: "setActiveGroup",
        groupId,
      });
    } catch (error) {
      console.error("[Sidebar] ❌ Failed to set active group:", error);
      console.error("[Sidebar] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        groupId: groupId,
      });
    }
  };

  return (
    <div
      className="w-full h-screen overflow-hidden bg-background sidebar-zoom-wrapper"
      style={{
        transform: `scale(${zoomLevel / 100})`,
        transformOrigin: "top left",
        width: `${100 / (zoomLevel / 100)}%`,
        height: `${100 / (zoomLevel / 100)}%`,
      }}
    >
      <SidebarHeader onCreateGroup={handleCreateGroup} />

      <div className="flex-1 overflow-y-auto">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            isActive={group.id === activeGroupId}
            onEdit={handleEditGroup}
            onDelete={handleGroupDeleted}
            onSetActive={handleSetActiveGroup}
          />
        ))}
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center mb-4">
              <span className="text-3xl">📚</span>
            </div>
            <p className="text-text-secondary text-sm">No groups yet</p>
            <p className="text-text-secondary/70 text-xs mt-1">
              Create your first group to get started!
            </p>
          </div>
        )}
      </div>

      <GroupModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        group={modalState.group}
        onClose={() => setModalState({ isOpen: false, mode: "create" })}
        onGroupCreated={handleGroupCreated}
        onGroupUpdated={handleGroupUpdated}
      />
    </div>
  );
};

export default Sidebar;
