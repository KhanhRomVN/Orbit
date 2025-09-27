import React, { useState, useEffect } from "react";
import SidebarHeader from "./SidebarHeader";
import SidebarContent from "./SidebarContent";
import StatusBar from "./StatusBar";

interface ClaudeTab {
  id: number;
  title: string;
  url: string;
  active: boolean;
  cookieStoreId?: string;
  containerName?: string;
  containerColor?: string;
  containerIcon?: string;
}

interface Container {
  cookieStoreId: string;
  name: string;
  color: string;
  icon: string;
}

const Sidebar: React.FC = () => {
  const [tabs, setTabs] = useState<ClaudeTab[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTab, setIsCreatingTab] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    type: "loading" | "success" | "error" | "info";
  }>({
    message: "Loading...",
    type: "loading",
  });

  const browserAPI = (window as any).browser || (window as any).chrome;

  useEffect(() => {
    loadManagedTabs();
    loadContainers();
    setupMessageListener();
  }, []);

  const setupMessageListener = () => {
    browserAPI.runtime.onMessage.addListener((message: any) => {
      if (message.action === "tabUpdate") {
        loadManagedTabs();
      }
    });
  };

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

  const loadManagedTabs = async () => {
    setIsLoading(true);
    setStatus({ message: "Loading managed tabs...", type: "loading" });

    try {
      // Get all Claude tabs (only managed ones will be returned)
      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "getClaudeTabs" },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (
        result &&
        (result as any).success &&
        Array.isArray((result as any).tabs)
      ) {
        const managedTabs = (result as any).tabs;

        // Get current active tab to mark it
        const currentTabs = await browserAPI.tabs.query({});
        const activeTabs = currentTabs.filter((tab: any) => tab.active);

        const formattedTabs = managedTabs.map((tab: any) => ({
          ...tab,
          active: activeTabs.some((activeTab: any) => activeTab.id === tab.id),
          containerName: tab.containerName || "Default",
          containerColor: tab.containerColor || "blue",
          containerIcon: tab.containerIcon || "default",
        }));

        setTabs(formattedTabs);

        if (formattedTabs.length === 0) {
          setStatus({
            message:
              "No managed Claude tabs. Click 'New Claude Tab' to get started.",
            type: "info",
          });
        } else {
          setStatus({
            message: `${formattedTabs.length} managed tab${
              formattedTabs.length > 1 ? "s" : ""
            }`,
            type: "success",
          });
        }
      } else {
        setTabs([]);
        setStatus({
          message: "Error loading managed tabs",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error loading managed tabs:", error);
      setTabs([]);
      setStatus({
        message: "Error loading tabs",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewTab = async (containerCookieStoreId?: string) => {
    if (isCreatingTab) return;

    setIsCreatingTab(true);
    setStatus({
      message: "Creating new Claude tab...",
      type: "loading",
    });

    try {
      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          {
            action: "createClaudeTab",
            containerCookieStoreId,
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
        const newTab = (result as any).tab;
        setStatus({
          message: `New Claude tab created in ${
            containerCookieStoreId
              ? containers.find(
                  (c) => c.cookieStoreId === containerCookieStoreId
                )?.name || "container"
              : "default container"
          }`,
          type: "success",
        });

        // Refresh tabs after a short delay to allow the tab to fully initialize
        setTimeout(() => {
          loadManagedTabs();
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

  const createTabInContainer = async (containerCookieStoreId: string) => {
    await createNewTab(containerCookieStoreId);
  };

  const focusTab = async (tabId: number) => {
    try {
      await browserAPI.tabs.update(tabId, { active: true });
      const tab = await browserAPI.tabs.get(tabId);
      await browserAPI.windows.update(tab.windowId, { focused: true });

      // Update local state to reflect the active tab
      setTabs((prevTabs) =>
        prevTabs.map((t) => ({
          ...t,
          active: t.id === tabId,
        }))
      );
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

      // Remove from managed tabs via background script
      await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "removeManagedTab", tabId },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      // Update local state immediately
      setTabs((prevTabs) => prevTabs.filter((tab) => tab.id !== tabId));

      setStatus({
        message: "Tab closed",
        type: "success",
      });
    } catch (error) {
      console.error("Error closing tab:", error);
      setStatus({
        message: "Error closing tab",
        type: "error",
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <SidebarHeader
        onNewTab={() => createNewTab()}
        onRefresh={loadManagedTabs}
        isCreatingTab={isCreatingTab}
        containers={containers}
        onCreateTabInContainer={createTabInContainer}
      />
      <StatusBar status={status} />
      <SidebarContent
        tabs={tabs}
        containers={containers}
        isLoading={isLoading}
        onFocusTab={focusTab}
        onCloseTab={closeTab}
      />
    </div>
  );
};

export default Sidebar;
