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
    loadGroups();
    loadActiveGroup();

    // Listen for groups update from background
    const messageListener = (message: any) => {
      if (message.action === "groupsUpdated") {
        setGroups(message.groups);
        setActiveGroupId(message.activeGroupId);
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

  const handleGroupCreated = (newGroup: TabGroup) => {
    setGroups((prev) => [...prev, newGroup]);
    setModalState({ isOpen: false, mode: "create" });
  };

  const handleGroupUpdated = (updatedGroup: TabGroup) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === updatedGroup.id ? updatedGroup : g))
    );
    setModalState({ isOpen: false, mode: "create" });
  };

  const handleGroupDeleted = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
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
      console.error("Failed to set active group:", error);
    }
  };

  return (
    <div className="w-80 h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
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
  );
};

export default Sidebar;
