import React, { useState, useEffect } from "react";
import SidebarHeader from "./SidebarHeader";
import GroupList from "./GroupList";
import StatusBar from "./StatusBar";

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

const Sidebar: React.FC = () => {
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsCreatingTab] = useState(false);
  const [viewMode, setViewMode] = useState<"compact" | "normal" | "detailed">(
    "normal"
  );
  const [status, setStatus] = useState<{
    message: string;
    type: "loading" | "success" | "error" | "info";
  }>({
    message: "Loading...",
    type: "loading",
  });
  // Track which container groups to show (hidden by default)
  const [visibleContainerGroups, setVisibleContainerGroups] = useState<
    string[]
  >([]);
  // Persist container-group visibility across sidebar toggles
  useEffect(() => {
    const saved = localStorage.getItem("visibleContainerGroups");
    if (saved) {
      try {
        setVisibleContainerGroups(JSON.parse(saved));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  // Save visibility changes
  useEffect(() => {
    localStorage.setItem(
      "visibleContainerGroups",
      JSON.stringify(visibleContainerGroups)
    );
  }, [visibleContainerGroups]);

  const browserAPI = (window as any).browser || (window as any).chrome;

  useEffect(() => {
    // Listen for background updates
    const handler = (message: any) => {
      if (message.action === "tabUpdate" || message.action === "groupUpdate") {
        loadGroups();
      }
    };
    browserAPI.runtime.onMessage.addListener(handler);
    // Initial load of groups and containers
    loadGroups();
    loadContainers();
    return () => {
      browserAPI.runtime.onMessage.removeListener(handler);
    };
  }, []);

  const loadContainers = async () => {
    try {
      if (browserAPI.contextualIdentities?.query) {
        const containerData = await browserAPI.contextualIdentities.query({});
        setContainers(containerData);
      }
    } catch (error) {
      console.warn("Could not fetch containers:", error);
    }
  };

  const loadGroups = async () => {
    setIsLoading(true);
    setStatus({ message: "Loading groups and tabs...", type: "loading" });

    try {
      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "getGroups" },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      console.log("[DEBUG] Sidebar: getGroups response:", result); // Debug log

      if (
        result &&
        (result as any).success &&
        Array.isArray((result as any).groups)
      ) {
        const groupsData = (result as any).groups as TabGroup[];
        console.log("[DEBUG] Sidebar: Groups data received:", groupsData); // Debug log
        setGroups(groupsData);

        // Update status thành công
        setStatus({
          message: `Loaded ${groupsData.length} groups successfully`,
          type: "success",
        });
      } else {
        console.error("[DEBUG] Sidebar: Invalid response format:", result);
        setGroups([]);
        setStatus({
          message: "Error loading groups and tabs",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error loading groups:", error);
      setGroups([]);
      setStatus({
        message: "Error loading groups",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createTabInContainer = async (
    containerCookieStoreId?: string,
    groupId?: string
  ) => {
    setIsCreatingTab(true);
    setStatus({
      message: "Creating new Claude tab...",
      type: "loading",
    });

    try {
      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          {
            action: "createTab",
            containerCookieStoreId,
            groupId,
          },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if ((result as any).success) {
        const containerName = containerCookieStoreId
          ? containers.find((c) => c.cookieStoreId === containerCookieStoreId)
              ?.name || "container"
          : "default container";

        setStatus({
          message: `New Claude tab created in ${containerName}`,
          type: "success",
        });

        // Refresh groups after a short delay
        setTimeout(() => {
          loadGroups();
        }, 1500);
      } else {
        setStatus({
          message: "Error creating tab",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error creating new tab:", error);
      setStatus({
        message: "Error creating tab",
        type: "error",
      });
    } finally {
      setIsCreatingTab(false);
    }
  };

  const createTabInGroup = async (
    groupId: string,
    containerCookieStoreId?: string
  ) => {
    // Ensure container group stays visible when expanded
    setVisibleContainerGroups((prev) =>
      Array.from(new Set([...prev, groupId]))
    );
    const group = groups.find((g) => g.id === groupId);
    if (!group) {
      console.error("[DEBUG] Sidebar: Group not found:", groupId);
      return;
    }
    if (group.type === "container") {
      setVisibleContainerGroups((prev) =>
        Array.from(new Set([...prev, groupId]))
      );
    }

    console.log("[DEBUG] Sidebar: createTabInGroup called:", {
      groupId,
      groupName: group.name,
      groupType: group.type,
      containerCookieStoreId: group.containerCookieStoreId,
      passedContainerCookieStoreId: containerCookieStoreId,
    });

    if (group.type === "container") {
      // Sử dụng containerCookieStoreId từ group thay vì parameter
      console.log("[DEBUG] Sidebar: Creating tab in container group");
      await createTabInContainer(group.containerCookieStoreId, groupId);
    } else {
      // For custom groups, create tab in specified container or default
      console.log("[DEBUG] Sidebar: Creating tab in custom group");
      await createTabInContainer(containerCookieStoreId, groupId);
    }
  };

  const createCustomGroup = async (name: string) => {
    setStatus({ message: "Creating custom group...", type: "loading" });

    try {
      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "createGroup", name, type: "custom" },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if ((result as any).success) {
        setStatus({
          message: `Custom group "${name}" created`,
          type: "success",
        });
        loadGroups();
      } else {
        setStatus({
          message: "Error creating custom group",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error creating custom group:", error);
      setStatus({
        message: "Error creating custom group",
        type: "error",
      });
    }
  };

  const updateGroup = async (groupId: string, updates: Partial<TabGroup>) => {
    try {
      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "updateGroup", groupId, updates },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if ((result as any).success) {
        loadGroups();
      }
    } catch (error) {
      console.error("Error updating group:", error);
      setStatus({
        message: "Error updating group",
        type: "error",
      });
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "deleteGroup", groupId },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if ((result as any).success) {
        setStatus({
          message: "Group deleted",
          type: "success",
        });
        loadGroups();
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      setStatus({
        message: "Error deleting group",
        type: "error",
      });
    }
  };

  const focusTab = async (tabId: number) => {
    try {
      await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "focusTab", tabId },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      // Update local state to reflect the focused tab
      setGroups((prevGroups) =>
        prevGroups.map((group) => ({
          ...group,
          tabs: group.tabs.map((tab) => ({
            ...tab,
            active: tab.id === tabId,
          })),
        }))
      );
      // Refresh groups to ensure all tab states are correct
      setTimeout(() => {
        loadGroups();
      }, 100);
    } catch (error) {
      console.error("Error focusing tab:", error);
      setStatus({
        message: "Error focusing tab",
        type: "error",
      });
    }
  };

  const closeTab = async (tabId: number) => {
    try {
      await browserAPI.tabs.remove(tabId);
      setStatus({
        message: "Tab closed",
        type: "success",
      });

      // Refresh groups to reflect changes
      setTimeout(() => {
        loadGroups();
      }, 500);
    } catch (error) {
      console.error("Error closing tab:", error);
      setStatus({
        message: "Error closing tab",
        type: "error",
      });
    }
  };

  const addTabToGroup = async (tabId: number, groupId: string) => {
    try {
      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "addTabToGroup", tabId, groupId },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if ((result as any).success) {
        loadGroups();
      }
    } catch (error) {
      console.error("Error adding tab to group:", error);
    }
  };

  const removeTabFromGroup = async (tabId: number, groupId: string) => {
    try {
      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "removeTabFromGroup", tabId, groupId },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if ((result as any).success) {
        loadGroups();
        // Only show custom groups and explicitly selected container groups
      }
    } catch (error) {
      console.error("Error removing tab from group:", error);
    }
  };

  const toggleContainerVisibility = (groupId: string, visible: boolean) => {
    setVisibleContainerGroups((prev) =>
      visible
        ? Array.from(new Set([...prev, groupId]))
        : prev.filter((id) => id !== groupId)
    );
  };

  // Custom groups luôn hiển thị, container groups chỉ hiển thị khi được chọn
  // Custom groups luôn hiển thị, container groups chỉ hiển thị khi được chọn
  const groupsToDisplay = groups.filter((g) => {
    if (g.type === "custom") {
      console.log("[DEBUG] Sidebar: Showing custom group:", g.id, g.name);
      return true; // Luôn hiển thị custom groups (bao gồm Default Group)
    }
    // Container groups chỉ hiển thị khi được explicitly selected
    const shouldShow = visibleContainerGroups.includes(g.id);
    console.log(
      "[DEBUG] Sidebar: Container group",
      g.id,
      "visible:",
      shouldShow
    );
    return shouldShow;
  });

  console.log(
    "[DEBUG] Sidebar: Total groups:",
    groups.length,
    "Groups to display:",
    groupsToDisplay.length
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <SidebarHeader
        containers={containers}
        onCreateTabInContainer={createTabInContainer}
        onCreateCustomGroup={createCustomGroup}
        onGroupCreated={(groupId: string) => {
          setVisibleContainerGroups((prev) =>
            Array.from(new Set([...prev, groupId]))
          );
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <StatusBar status={status} />

      <GroupList
        groups={groupsToDisplay}
        containers={containers}
        isLoading={isLoading}
        viewMode={viewMode}
        onFocusTab={focusTab}
        onCloseTab={closeTab}
        onUpdateGroup={updateGroup}
        onDeleteGroup={deleteGroup}
        onCreateTabInGroup={createTabInGroup}
        onAddTabToGroup={addTabToGroup}
        onRemoveTabFromGroup={removeTabFromGroup}
        onToggleVisibility={toggleContainerVisibility}
      />
    </div>
  );
};

export default Sidebar;
