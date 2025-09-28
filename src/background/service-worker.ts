declare const browser: typeof chrome;

interface BrowserContainer {
  cookieStoreId: string;
  name: string;
  icon: string;
  color: string;
}

interface ExtendedTab extends chrome.tabs.Tab {
  cookieStoreId?: string;
}

interface FirefoxBrowserAPI {
  contextualIdentities?: {
    query: (details: any) => Promise<BrowserContainer[]>;
  };
  permissions?: {
    contains: (permissions: { permissions: string[] }) => Promise<boolean>;
  };
  tabs: typeof chrome.tabs;
  runtime: typeof chrome.runtime;
  windows: typeof chrome.windows;
  scripting?: typeof chrome.scripting;
  storage: typeof chrome.storage;
  sidebarAction?: {
    open: () => Promise<void>;
  };
}

interface TabGroup {
  id: string;
  name: string;
  type: "container" | "custom";
  containerCookieStoreId?: string;
  tabIds: number[];
  expanded: boolean;
  color?: string;
  icon?: string;
  created: number;
  lastModified: number;
}

interface GroupStorage {
  groups: TabGroup[];
  managedTabs: number[];
  sidebarCreatedTabs: number[];
}

(function () {
  "use strict";

  const browserAPI = (function (): FirefoxBrowserAPI {
    if (typeof browser !== "undefined")
      return browser as unknown as FirefoxBrowserAPI;
    if (typeof chrome !== "undefined")
      return chrome as unknown as FirefoxBrowserAPI;
    throw new Error("No browser API available");
  })();

  class ClaudeTabManager {
    private claudeTabs: Map<number, any> = new Map();
    private managedTabs: Set<number> = new Set();
    private sidebarCreatedTabs: Set<number> = new Set();
    private groups: Map<string, TabGroup> = new Map();

    constructor() {
      this.loadStoredData();
      this.setupTabListeners();
      this.setupMessageHandlers();
      this.setupBeforeUnloadHandler();
    }

    private async loadStoredData(): Promise<void> {
      try {
        const result = await browserAPI.storage.local.get([
          "managedTabs",
          "sidebarCreatedTabs",
          "groups",
        ]);

        if (result.managedTabs && Array.isArray(result.managedTabs)) {
          this.managedTabs = new Set(result.managedTabs);
        }
        if (
          result.sidebarCreatedTabs &&
          Array.isArray(result.sidebarCreatedTabs)
        ) {
          this.sidebarCreatedTabs = new Set(result.sidebarCreatedTabs);
        }
        if (result.groups && Array.isArray(result.groups)) {
          result.groups.forEach((group: TabGroup) => {
            this.groups.set(group.id, group);
          });
        }

        // Create default container groups if they don't exist
        await this.initializeContainerGroups();

        // Clean up invalid tabs and groups
        await this.cleanupInvalidData();
      } catch (error) {
        console.error("Error loading stored data:", error);
      }
    }

    private async saveStoredData(): Promise<void> {
      try {
        const data: GroupStorage = {
          groups: Array.from(this.groups.values()),
          managedTabs: Array.from(this.managedTabs),
          sidebarCreatedTabs: Array.from(this.sidebarCreatedTabs),
        };
        await browserAPI.storage.local.set(data);
      } catch (error) {
        console.error("Error saving stored data:", error);
      }
    }

    private async initializeContainerGroups(): Promise<void> {
      try {
        // Ensure a group exists for each browser container
        let containers: BrowserContainer[] = [];
        if (browserAPI.contextualIdentities?.query) {
          containers = await browserAPI.contextualIdentities.query({});
        }
        for (const c of containers) {
          const groupId = `container-${c.cookieStoreId}`;
          const existing = this.groups.get(groupId);
          if (!existing) {
            const newGroup: TabGroup = {
              id: groupId,
              name: c.name,
              type: "container",
              containerCookieStoreId: c.cookieStoreId,
              tabIds: [],
              expanded: true,
              created: Date.now(),
              lastModified: Date.now(),
              icon: c.icon,
              color: c.color,
            };
            this.groups.set(groupId, newGroup);
            console.log("[DEBUG] Created container group:", groupId);
          } else {
            // Update container metadata if changed
            existing.name = c.name;
            existing.icon = c.icon;
            existing.color = c.color;
            existing.lastModified = Date.now();
            this.groups.set(groupId, existing);
          }
        }
        await this.saveStoredData();
      } catch (error) {
        console.error("Error in initializeContainerGroups:", error);
      }
    }

    private async cleanupInvalidData(): Promise<void> {
      try {
        const allTabs = await browserAPI.tabs.query({});
        const validTabIds = new Set(
          allTabs.map((tab) => tab.id).filter((id) => id !== undefined)
        );

        // Remove invalid tabs from managed tabs
        const invalidManagedTabs = Array.from(this.managedTabs).filter(
          (id) => !validTabIds.has(id)
        );
        invalidManagedTabs.forEach((id) => {
          this.managedTabs.delete(id);
          this.sidebarCreatedTabs.delete(id);
        });

        // Remove invalid tabs from groups
        this.groups.forEach((group) => {
          group.tabIds = group.tabIds.filter((id) => validTabIds.has(id));
          group.lastModified = Date.now();
        });

        if (invalidManagedTabs.length > 0) {
          await this.saveStoredData();
        }
      } catch (error) {
        console.error("Error cleaning up invalid data:", error);
      }
    }

    private setupBeforeUnloadHandler(): void {
      // Save data before extension unload
      browserAPI.runtime.onSuspend?.addListener(() => {
        this.saveStoredData();
      });

      // Also save periodically
      setInterval(() => {
        this.saveStoredData();
      }, 30000); // Save every 30 seconds
    }

    private setupTabListeners(): void {
      browserAPI.tabs.onCreated.addListener(async (tab) => {
        if (this.isClaudeTab(tab) && this.shouldAutoManageTab(tab)) {
          setTimeout(async () => {
            if (tab.id) {
              await this.addManagedTab(tab.id, true);
              this.notifySidebar("tabUpdate");
            }
          }, 1000);
        }
      });

      browserAPI.tabs.onRemoved.addListener((tabId) => {
        if (this.managedTabs.has(tabId)) {
          this.removeTabFromAllGroups(tabId);
          this.managedTabs.delete(tabId);
          this.sidebarCreatedTabs.delete(tabId);
          this.saveStoredData();
          this.notifySidebar("tabUpdate");
        }
        this.claudeTabs.delete(tabId);
      });

      browserAPI.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
        if (this.managedTabs.has(tabId) || this.isClaudeTab(tab)) {
          this.notifySidebar("tabUpdate");
        }
      });
    }

    private setupMessageHandlers(): void {
      browserAPI.runtime.onMessage.addListener(
        (request: any, _sender: any, sendResponse: any) => {
          (async () => {
            try {
              switch (request.action) {
                case "createTab":
                  console.log(
                    "[DEBUG] Background: createTab message received:",
                    {
                      containerCookieStoreId: request.containerCookieStoreId,
                      groupId: request.groupId,
                    }
                  );
                  const newTab = await this.createTab(
                    request.containerCookieStoreId,
                    request.groupId
                  );
                  sendResponse({ success: true, tab: newTab });
                  break;

                case "markTabAsSidebarCreated":
                  if (request.tabId) {
                    this.sidebarCreatedTabs.add(request.tabId);
                    await this.saveStoredData();
                  }
                  sendResponse({ success: true });
                  break;

                case "getGroups":
                  const groups = await this.getGroupsWithTabs();
                  sendResponse({ success: true, groups });
                  break;

                case "createGroup":
                  const group = await this.createGroup(
                    request.name,
                    request.type,
                    request.containerCookieStoreId
                  );
                  sendResponse({ success: true, group });
                  break;

                case "updateGroup":
                  const updatedGroup = await this.updateGroup(
                    request.groupId,
                    request.updates
                  );
                  sendResponse({ success: true, group: updatedGroup });
                  break;

                case "deleteGroup":
                  await this.deleteGroup(request.groupId);
                  sendResponse({ success: true });
                  break;

                case "addTabToGroup":
                  await this.addTabToGroup(request.tabId, request.groupId);
                  sendResponse({ success: true });
                  break;

                case "removeTabFromGroup":
                  await this.removeTabFromGroup(request.tabId, request.groupId);
                  sendResponse({ success: true });
                  break;

                case "focusTab":
                  await this.focusTab(request.tabId);
                  sendResponse({ success: true });
                  break;

                case "sendPrompt":
                  const result = await this.sendPromptToTab(
                    request.tabId,
                    request.prompt
                  );
                  sendResponse(result);
                  break;

                case "addManagedTab":
                  await this.addManagedTab(request.tabId, false);
                  sendResponse({ success: true });
                  break;

                case "removeManagedTab":
                  await this.removeManagedTab(request.tabId);
                  sendResponse({ success: true });
                  break;

                case "openSidebar":
                  await this.openSidebar();
                  sendResponse({ success: true });
                  break;

                case "openTabManager":
                  await this.openTabManager();
                  sendResponse({ success: true });
                  break;

                default:
                  sendResponse({ success: false, error: "Unknown action" });
              }
            } catch (error) {
              console.error("Background: Error handling message:", error);
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              sendResponse({ success: false, error: errorMessage });
            }
          })();

          return true;
        }
      );
    }

    private async createGroup(
      name: string,
      type: "container" | "custom",
      containerCookieStoreId?: string
    ): Promise<TabGroup> {
      console.log("[DEBUG] createGroup called:", {
        name,
        type,
        containerCookieStoreId,
      });

      // Validate container group doesn't already exist
      if (type === "container" && containerCookieStoreId) {
        const existingGroup = Array.from(this.groups.values()).find(
          (g) =>
            g.type === "container" &&
            g.containerCookieStoreId === containerCookieStoreId
        );
        if (existingGroup) {
          console.log("[DEBUG] Container group already exists:", existingGroup);
          return existingGroup;
        }
      }

      const groupId =
        type === "container"
          ? `container-${containerCookieStoreId}`
          : `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log("[DEBUG] Creating new group with ID:", groupId);

      const group: TabGroup = {
        id: groupId,
        name,
        type,
        containerCookieStoreId:
          type === "container" ? containerCookieStoreId : undefined,
        tabIds: [],
        expanded: true,
        created: Date.now(),
        lastModified: Date.now(),
      };

      this.groups.set(groupId, group);
      await this.saveStoredData();
      this.notifySidebar("groupUpdate");

      console.log("[DEBUG] Group created successfully:", group);
      return group;
    }

    private async updateGroup(
      groupId: string,
      updates: Partial<TabGroup>
    ): Promise<TabGroup | null> {
      const group = this.groups.get(groupId);
      if (!group) return null;

      Object.assign(group, updates, { lastModified: Date.now() });
      this.groups.set(groupId, group);
      await this.saveStoredData();
      this.notifySidebar("groupUpdate");

      return group;
    }

    private async deleteGroup(groupId: string): Promise<void> {
      const group = this.groups.get(groupId);
      if (!group) {
        throw new Error("Group not found");
      }

      // Close all tabs in the group before deleting it
      for (const tabId of group.tabIds) {
        try {
          await browserAPI.tabs.remove(tabId);
        } catch (error) {
          console.error(`Failed to close tab ${tabId} during group deletion:`, error);
        }
      }

      // Delete the group and notify
      this.groups.delete(groupId);
      await this.saveStoredData();
      this.notifySidebar("groupUpdate");
    }

    private async addTabToGroup(tabId: number, groupId: string): Promise<void> {
      const group = this.groups.get(groupId);
      if (!group) return;

      // Remove tab from other groups first (except for custom groups)
      if (group.type === "container") {
        this.removeTabFromAllGroups(tabId);
      }

      if (!group.tabIds.includes(tabId)) {
        group.tabIds.push(tabId);
        group.lastModified = Date.now();
        await this.saveStoredData();
        this.notifySidebar("tabUpdate");
      }
    }

    private async removeTabFromGroup(
      tabId: number,
      groupId: string
    ): Promise<void> {
      const group = this.groups.get(groupId);
      if (!group) return;

      group.tabIds = group.tabIds.filter((id) => id !== tabId);
      group.lastModified = Date.now();
      await this.saveStoredData();
      this.notifySidebar("tabUpdate");
    }

    private removeTabFromAllGroups(tabId: number): void {
      this.groups.forEach((group) => {
        if (group.tabIds.includes(tabId)) {
          group.tabIds = group.tabIds.filter((id) => id !== tabId);
          group.lastModified = Date.now();
        }
      });
    }

    private async focusTab(tabId: number): Promise<void> {
      try {
        const tab = await browserAPI.tabs.get(tabId);
        await browserAPI.tabs.update(tabId, { active: true });
        await browserAPI.windows.update(tab.windowId, { focused: true });
      } catch (error) {
        console.error("Error focusing tab:", error);
        throw error;
      }
    }

    private shouldAutoManageTab(tab: chrome.tabs.Tab): boolean {
      // Chỉ auto-manage tab claude.ai nếu chưa được manage bởi extension
      const isClaudeTab =
        tab.url === "https://claude.ai/chat" ||
        tab.url === "https://claude.ai/";
      const alreadyManaged = tab.id ? this.managedTabs.has(tab.id) : false;

      return isClaudeTab && !alreadyManaged;
    }

    private async createTab(
      cookieStoreId?: string,
      groupId?: string
    ): Promise<any> {
      console.log("[DEBUG] createTab called:", { cookieStoreId, groupId });

      try {
        const tabOptions: any = {
          active: true,
        };

        // Áp dụng container nếu có
        if (cookieStoreId && cookieStoreId !== "firefox-default") {
          tabOptions.cookieStoreId = cookieStoreId;
          console.log(
            "[DEBUG] Setting cookieStoreId in tab options:",
            cookieStoreId
          );
        } else {
          console.log("[DEBUG] Using default container (firefox-default)");
        }

        console.log("[DEBUG] Tab creation options:", tabOptions);

        const tab = await browserAPI.tabs.create(tabOptions);
        console.log("[DEBUG] Tab created:", {
          id: tab.id,
          url: tab.url,
          cookieStoreId: (tab as any).cookieStoreId,
        });

        if (tab.id) {
          // Mark tab as managed by the extension
          await this.addManagedTab(tab.id, true);

          // Add to group if specified
          if (groupId) {
            console.log("[DEBUG] Adding tab to group:", groupId);
            setTimeout(async () => {
              await this.addTabToGroup(tab.id!, groupId);
            }, 500);
          }
        }

        return tab;
      } catch (error) {
        console.error("[DEBUG] Error creating new tab:", error);
        throw error;
      }
    }

    private async openSidebar(): Promise<void> {
      try {
        if (browserAPI.sidebarAction?.open) {
          await browserAPI.sidebarAction.open();
        } else {
          console.warn("Sidebar API not available");
        }
      } catch (error) {
        console.error("Error opening sidebar:", error);
        throw error;
      }
    }

    private async openTabManager(): Promise<void> {
      try {
        const existingTabs = await browserAPI.tabs.query({
          url: browserAPI.runtime.getURL("index.html"),
        });

        if (existingTabs.length > 0) {
          // Focus existing tab
          await this.focusTab(existingTabs[0].id!);
        } else {
          // Create new tab
          await browserAPI.tabs.create({
            url: browserAPI.runtime.getURL("index.html"),
            active: true,
          });
        }
      } catch (error) {
        console.error("Error opening tab manager:", error);
        throw error;
      }
    }

    private isClaudeTab(tab: chrome.tabs.Tab): boolean {
      if (!tab.url) return false;

      const claudePatterns = [
        /https?:\/\/claude\.ai/i,
        /https?:\/\/.*\.claude\.ai/i,
      ];

      return claudePatterns.some((pattern) => pattern.test(tab.url!));
    }

    private notifySidebar(action: string): void {
      browserAPI.runtime.sendMessage({ action }).catch(() => {
        // Sidebar might not be open, ignore error
      });
    }

    private async getGroupsWithTabs(): Promise<any[]> {
      try {
        await this.initializeContainerGroups();
        await this.cleanupInvalidData();

        const allTabs = await browserAPI.tabs.query({});
        // Include all managed tabs, not only Claude URLs, so blank placeholders show up
        const claudeTabs = allTabs.filter((tab: any) => tab.id && this.managedTabs.has(tab.id));

        // Get container information
        let containers: BrowserContainer[] = [];
        try {
          if (browserAPI.contextualIdentities?.query) {
            containers = await browserAPI.contextualIdentities.query({});
          }
        } catch (error) {
          console.error("Error fetching containers:", error);
        }

        // Build groups with their tabs
        const groupsWithTabs = Array.from(this.groups.values()).map((group) => {
          const groupTabs = claudeTabs
            .filter((tab) => group.tabIds.includes(tab.id!))
            .map((tab: any) => {
              const extendedTab = tab as ExtendedTab;
              const cookieStoreId =
                extendedTab.cookieStoreId || "firefox-default";
              const container = containers.find(
                (c) => c.cookieStoreId === cookieStoreId
              );

              return {
                id: tab.id || 0,
                title: tab.title || "Untitled Tab",
                url: tab.url || "",
                active: tab.active || false,
                container: cookieStoreId,
                containerName: container?.name || "Default",
                containerIcon: container?.icon || "default",
                containerColor: container?.color || "gray",
              };
            });

          return {
            ...group,
            tabs: groupTabs,
          };
        });

        // Sort groups: container groups first, then custom groups
        return groupsWithTabs.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "container" ? -1 : 1;
          }
          if (a.name === "Default Container") return -1;
          if (b.name === "Default Container") return 1;
          return a.name.localeCompare(b.name);
        });
      } catch (error) {
        console.error("Error getting groups with tabs:", error);
        return [];
      }
    }

    async addManagedTab(
      tabId: number,
      isSidebarCreated: boolean = false
    ): Promise<void> {
      this.managedTabs.add(tabId);
      if (isSidebarCreated) {
        this.sidebarCreatedTabs.add(tabId);
      }

      // Try to auto-assign to appropriate container group
      try {
        const tab = await browserAPI.tabs.get(tabId);
        const extendedTab = tab as ExtendedTab;
        const cookieStoreId = extendedTab.cookieStoreId || "firefox-default";
        const groupId = `container-${cookieStoreId}`;

        if (this.groups.has(groupId)) {
          await this.addTabToGroup(tabId, groupId);
        }
      } catch (error) {
        console.error("Error auto-assigning tab to group:", error);
      }

      await this.saveStoredData();
      this.notifySidebar("tabUpdate");
    }

    async removeManagedTab(tabId: number): Promise<void> {
      this.removeTabFromAllGroups(tabId);
      this.managedTabs.delete(tabId);
      this.sidebarCreatedTabs.delete(tabId);
      await this.saveStoredData();
      this.notifySidebar("tabUpdate");
    }

    getManagedTabs(): number[] {
      return Array.from(this.managedTabs);
    }

    async sendPromptToTab(
      tabId: number,
      prompt: string
    ): Promise<{ success: boolean; response?: string }> {
      try {
        if (!this.managedTabs.has(tabId)) {
          return {
            success: false,
            response:
              "Tab is not managed by sidebar. Please use the sidebar to open Claude tabs.",
          };
        }

        await this.ensureContentScriptInjected(tabId);

        const response = await browserAPI.tabs.sendMessage(tabId, {
          action: "sendPrompt",
          prompt: prompt,
        });

        return response;
      } catch (error) {
        console.error("Error sending prompt to tab:", error);
        return { success: false };
      }
    }

    private async ensureContentScriptInjected(tabId: number): Promise<void> {
      try {
        await browserAPI.tabs.sendMessage(tabId, { action: "ping" });
      } catch (error) {
        if (browserAPI.scripting && browserAPI.scripting.executeScript) {
          await browserAPI.scripting.executeScript({
            target: { tabId },
            files: ["claude-content.js"],
          });
        } else {
          await browserAPI.tabs.executeScript(tabId, {
            file: "claude-content.js",
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  new ClaudeTabManager();
})();
