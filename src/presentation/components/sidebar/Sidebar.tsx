// File: src/presentation/components/sidebar/Sidebar.tsx
import React, { useState, useEffect } from "react";
import SidebarHeader from "./SidebarHeader";
import GroupCard from "./GroupCard";
import GroupModal from "./GroupModal";
import { TabGroup, GroupModalState } from "@/types/tab-group";
import { getBrowserAPI } from "@/shared/lib/browser-api";

const Sidebar: React.FC = () => {
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<GroupModalState>({
    isOpen: false,
    mode: "create",
  });

  useEffect(() => {
    const initializeSidebar = async () => {
      await loadGroups();
      await loadActiveGroup();
    };

    initializeSidebar();

    // Listen for groups update from background
    // Listen for groups update from background
    const messageListener = (message: any) => {
      console.log("[Sidebar] ===== MESSAGE RECEIVED =====");
      console.log("[Sidebar] Message action:", message.action);
      console.log("[Sidebar] Full message:", message);

      if (message.action === "groupsUpdated") {
        console.log("[Sidebar] 🔄 GROUPS UPDATED");
        console.log("[Sidebar] Previous groups count:", groups.length);
        console.log("[Sidebar] New groups count:", message.groups?.length || 0);
        console.log("[Sidebar] Previous activeGroupId:", activeGroupId);
        console.log("[Sidebar] New activeGroupId:", message.activeGroupId);

        setGroups(message.groups || []);
        setActiveGroupId(message.activeGroupId || null);

        console.log("[Sidebar] ✅ State updated");
      } else {
        console.log(
          "[Sidebar] ⚠️ Ignored message with action:",
          message.action
        );
      }

      console.log("[Sidebar] ===== MESSAGE END =====");
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
    console.log("[Sidebar] ===== SET ACTIVE GROUP START =====");
    console.log("[Sidebar] Requested groupId:", groupId);
    console.log("[Sidebar] Current activeGroupId:", activeGroupId);

    // Update UI state immediately
    console.log("[Sidebar] Updating UI state to:", groupId);
    setActiveGroupId(groupId);

    try {
      const browserAPI = getBrowserAPI();
      console.log("[Sidebar] Sending setActiveGroup message to background...");

      const result = await browserAPI.runtime.sendMessage({
        action: "setActiveGroup",
        groupId,
      });

      console.log("[Sidebar] ✅ setActiveGroup response:", result);
      console.log("[Sidebar] ===== SET ACTIVE GROUP END =====");
    } catch (error) {
      console.error("[Sidebar] ❌ Failed to set active group:", error);
      console.error("[Sidebar] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        groupId: groupId,
      });
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden">
      {/* Zoom Wrapper - this will be scaled */}
      <div className="sidebar-zoom-wrapper w-full h-full bg-gray-50 dark:bg-gray-900 flex flex-col">
        <SidebarHeader onCreateGroup={handleCreateGroup} />

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <p>No groups yet. Create your first group!</p>
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
    </div>
  );
};

export default Sidebar;
