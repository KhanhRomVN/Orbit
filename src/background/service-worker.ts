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
  scripting?: typeof chrome.scripting;
  storage: typeof chrome.storage;
  sidebarAction?: {
    open: () => Promise<void>;
  };
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
    private sidebarCreatedTabs: Set<number> = new Set(); // Track tabs created by sidebar

    constructor() {
      this.loadManagedTabs();
      this.setupTabListeners();
      this.setupMessageHandlers();
    }

    private async loadManagedTabs(): Promise<void> {
      try {
        const result = await browserAPI.storage.local.get([
          "managedTabs",
          "sidebarCreatedTabs",
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
      } catch (error) {
        console.error("Error loading managed tabs:", error);
      }
    }

    private async saveManagedTabs(): Promise<void> {
      try {
        await browserAPI.storage.local.set({
          managedTabs: Array.from(this.managedTabs),
          sidebarCreatedTabs: Array.from(this.sidebarCreatedTabs),
        });
      } catch (error) {
        console.error("Error saving managed tabs:", error);
      }
    }

    private setupTabListeners(): void {
      // Listen for tab creation - only auto-manage if created by sidebar
      browserAPI.tabs.onCreated.addListener(async (tab) => {
        // Check if this is a Claude tab created by sidebar
        if (this.isClaudeTab(tab) && this.shouldAutoManageTab(tab)) {
          // Wait a moment for the tab to fully initialize
          setTimeout(async () => {
            if (tab.id) {
              await this.addManagedTab(tab.id, true); // true indicates sidebar-created
              this.notifySidebar("tabUpdate");
            }
          }, 1000);
        }
      });

      // Listen for tab removal to clean up managed tabs
      browserAPI.tabs.onRemoved.addListener((tabId) => {
        if (this.managedTabs.has(tabId)) {
          this.managedTabs.delete(tabId);
          this.sidebarCreatedTabs.delete(tabId);
          this.saveManagedTabs();
          this.notifySidebar("tabUpdate");
        }
        this.claudeTabs.delete(tabId);
      });

      // Listen for tab updates
      browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (this.managedTabs.has(tabId) || this.isClaudeTab(tab)) {
          this.notifySidebar("tabUpdate");
        }
      });
    }

    private setupMessageHandlers(): void {
      // Handle messages from sidebar and popup
      browserAPI.runtime.onMessage.addListener(
        (request: any, sender: any, sendResponse: any) => {
          (async () => {
            try {
              switch (request.action) {
                case "createClaudeTab":
                  const newTab = await this.createClaudeTab(
                    request.containerCookieStoreId
                  );
                  sendResponse({ success: true, tab: newTab });
                  break;

                case "markTabAsSidebarCreated":
                  if (request.tabId) {
                    this.sidebarCreatedTabs.add(request.tabId);
                    await this.saveManagedTabs();
                  }
                  sendResponse({ success: true });
                  break;

                case "getClaudeTabs":
                  const tabs = await this.getClaudeTabs();
                  sendResponse({
                    success: true,
                    tabs: tabs.map((tab) => ({
                      id: tab.id,
                      title: tab.title || "Untitled",
                      url: tab.url || "",
                      container: tab.container || "",
                      containerName: tab.containerName || "Default",
                      containerIcon: tab.containerIcon || "default",
                      containerColor: tab.containerColor || "default",
                    })),
                  });
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

                case "getManagedTabs":
                  const managedTabs = this.getManagedTabs();
                  sendResponse({ success: true, tabs: managedTabs });
                  break;

                case "openSidebar":
                  await this.openSidebar();
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

          return true; // Keep message channel open for async response
        }
      );
    }

    private shouldAutoManageTab(tab: chrome.tabs.Tab): boolean {
      // Only auto-manage tabs that are likely created by the sidebar
      // This is a simple heuristic - you might need to adjust based on your needs
      return (
        tab.url === "https://claude.ai/chat" || tab.url === "https://claude.ai/"
      );
    }

    private async createClaudeTab(cookieStoreId?: string): Promise<any> {
      try {
        const tabOptions: any = {
          url: "https://claude.ai/chat",
          active: false,
        };

        if (cookieStoreId && cookieStoreId !== "firefox-default") {
          tabOptions.cookieStoreId = cookieStoreId;
        }

        const tab = await browserAPI.tabs.create(tabOptions);

        if (tab.id) {
          // Mark as sidebar-created and managed
          this.sidebarCreatedTabs.add(tab.id);
          await this.addManagedTab(tab.id, true);
        }

        return tab;
      } catch (error) {
        console.error("Error creating Claude tab:", error);
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

    private isClaudeTab(tab: chrome.tabs.Tab): boolean {
      if (!tab.url) return false;

      const claudePatterns = [
        /https?:\/\/claude\.ai/i,
        /https?:\/\/.*\.claude\.ai/i,
      ];

      return claudePatterns.some((pattern) => pattern.test(tab.url!));
    }

    private notifySidebar(action: string): void {
      // Try to notify sidebar about tab changes
      browserAPI.runtime.sendMessage({ action }).catch(() => {
        // Sidebar might not be open, ignore error
      });
    }

    async getClaudeTabs(): Promise<any[]> {
      try {
        // Query all tabs
        const tabs = await browserAPI.tabs.query({});

        // Filter for ONLY managed Claude tabs (tabs created/managed by sidebar)
        const claudeTabs = tabs.filter((tab: any) => {
          if (!tab.url || !tab.id) return false;
          // Must be both a Claude tab AND managed by sidebar
          return this.isClaudeTab(tab) && this.managedTabs.has(tab.id);
        });

        // Get container information
        let containers: BrowserContainer[] = [];
        try {
          const isFirefox = typeof browser !== "undefined";
          if (isFirefox && browserAPI.contextualIdentities?.query) {
            containers = await browserAPI.contextualIdentities.query({});
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error("Error details:", {
              name: error.name,
              message: error.message,
              stack: error.stack,
            });
          } else {
            console.error("Unknown error type:", String(error));
          }
        }

        // Store tabs for quick access
        claudeTabs.forEach((tab: any) => {
          if (tab.id) this.claudeTabs.set(tab.id, tab);
        });

        // Format tabs with container info
        const formattedTabs = claudeTabs.map((tab: any) => {
          const extendedTab = tab as ExtendedTab;
          const cookieStoreId = extendedTab.cookieStoreId || "firefox-default";

          const container = containers.find(
            (c) => c.cookieStoreId === cookieStoreId
          );

          let containerName = "Default";
          let containerIcon = "default";
          let containerColor = "default";

          if (container) {
            containerName = container.name;
            containerIcon = container.icon;
            containerColor = container.color;
          } else {
            if (cookieStoreId !== "firefox-default") {
              containerName = `Unknown Container (${cookieStoreId})`;
            }
          }

          return {
            id: tab.id || 0,
            title: tab.title || "Untitled Tab",
            url: tab.url || "",
            container: cookieStoreId,
            containerName: containerName,
            containerIcon: containerIcon,
            containerColor: containerColor,
          };
        });

        // Sort tabs by container name, then by title
        formattedTabs.sort((a: any, b: any) => {
          if (a.containerName !== b.containerName) {
            if (a.containerName === "Default") return -1;
            if (b.containerName === "Default") return 1;
            return a.containerName.localeCompare(b.containerName);
          }
          return a.title.localeCompare(b.title);
        });

        return formattedTabs;
      } catch (error) {
        console.error("Error getting Claude tabs:", error);
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
      await this.saveManagedTabs();
      this.notifySidebar("tabUpdate");
    }

    async removeManagedTab(tabId: number): Promise<void> {
      this.managedTabs.delete(tabId);
      this.sidebarCreatedTabs.delete(tabId);
      await this.saveManagedTabs();
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
        // Only allow sending prompts to managed tabs
        if (!this.managedTabs.has(tabId)) {
          return {
            success: false,
            response:
              "Tab is not managed by sidebar. Please use the sidebar to open Claude tabs.",
          };
        }

        // Inject content script if needed
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
        // Try to ping the content script first
        await browserAPI.tabs.sendMessage(tabId, { action: "ping" });
      } catch (error) {
        // If ping fails, inject the content script
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

        // Wait for injection to complete
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  const claudeManager = new ClaudeTabManager();
})();
