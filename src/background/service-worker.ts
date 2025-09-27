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

    async getClaudeTabs(): Promise<any[]> {
      try {
        // Query tất cả các tab
        const tabs = await browserAPI.tabs.query({});

        const claudeTabs = tabs.filter((tab: any) => {
          if (!tab.url || !tab.id) {
            return false;
          }

          // Mở rộng pattern matching - bao gồm cả HTTP và HTTPS
          const claudePatterns = [
            /https?:\/\/claude\.ai/i,
            /https?:\/\/.*\.claude\.ai/i,
            /moz-extension:\/\/.*claude\.ai/i,
            /chrome-extension:\/\/.*claude\.ai/i,
            // Thêm pattern cho URL có path
            /https?:\/\/claude\.ai\/chat/i,
            /https?:\/\/claude\.ai\/new/i,
          ];

          const isClaudeTab = claudePatterns.some((pattern) =>
            pattern.test(tab.url!)
          );

          return isClaudeTab;
        });

        // Get container information with detailed debugging
        let containers: BrowserContainer[] = [];

        try {
          // Check if we're in Firefox
          const isFirefox = typeof browser !== "undefined";

          if (isFirefox && browserAPI.contextualIdentities?.query) {
            containers = await browserAPI.contextualIdentities.query({});
          } else if (!isFirefox) {
          } else {
            console.warn("contextualIdentities API not available");
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

        // Đảm bảo data format chuẩn và thêm container info với debug chi tiết
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

          const result = {
            id: tab.id || 0,
            title: tab.title || "Untitled Tab",
            url: tab.url || "",
            container: cookieStoreId,
            containerName: containerName,
            containerIcon: containerIcon,
            containerColor: containerColor,
          };
          return result;
        });

        // Sắp xếp tabs theo container name, sau đó theo title
        formattedTabs.sort((a: any, b: any) => {
          if (a.containerName !== b.containerName) {
            // Default container lên đầu
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

    async sendPromptToTab(
      tabId: number,
      prompt: string
    ): Promise<{ success: boolean; response?: string }> {
      try {
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

    async getClaudeTabsWithFallback(): Promise<any[]> {
      // Thử phương pháp chính
      let claudeTabs = await this.getClaudeTabs();

      if (claudeTabs.length === 0) {
        try {
          const directTabs = await browserAPI.tabs.query({
            url: ["https://claude.ai/*", "https://*.claude.ai/*"],
          });
          claudeTabs = directTabs;
        } catch (error) {
          console.error("Fallback query failed:", error);
        }
      }

      return claudeTabs;
    }
  }

  const claudeManager = new ClaudeTabManager();

  // Handle messages from popup
  browserAPI.runtime.onMessage.addListener(
    (request: any, _sender: any, sendResponse: any) => {
      (async () => {
        try {
          switch (request.action) {
            case "getClaudeTabs":
              const tabs = await claudeManager.getClaudeTabs();
              const response = {
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
              };

              sendResponse(response);
              break;

            case "sendPrompt":
              const result = await claudeManager.sendPromptToTab(
                request.tabId,
                request.prompt
              );
              sendResponse(result);
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
})();
