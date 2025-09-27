declare const browser: typeof chrome;

(function () {
  "use strict";

  const browserAPI = (function () {
    if (typeof browser !== "undefined") return browser;
    if (typeof chrome !== "undefined") return chrome;
    throw new Error("No browser API available");
  })();

  class ClaudeTabManager {
    private claudeTabs: Map<number, any> = new Map();

    async getClaudeTabs(): Promise<any[]> {
      try {
        // Query tất cả các tab
        const tabs = await browserAPI.tabs.query({});
        console.log("All tabs found:", tabs.length);

        const claudeTabs = tabs.filter((tab) => {
          if (!tab.url || !tab.id) {
            return false;
          }

          console.log("Checking tab:", tab.url);

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

          if (isClaudeTab) {
            console.log("Found Claude tab:", tab.url, tab.title);
          }

          return isClaudeTab;
        });

        // Store tabs for quick access
        claudeTabs.forEach((tab) => {
          if (tab.id) this.claudeTabs.set(tab.id, tab);
        });

        console.log(`Total tabs checked: ${tabs.length}`);
        console.log(`Claude tabs found: ${claudeTabs.length}`);

        // Log tất cả URLs để debug (đặt trước return)
        tabs.forEach((tab) => {
          if (tab.url?.includes("claude")) {
            console.log("Tab containing 'claude':", tab.url, tab.title);
          }
        });

        // Đảm bảo data format chuẩn
        const formattedTabs = claudeTabs.map((tab) => ({
          id: tab.id || 0,
          title: tab.title || "Untitled Tab",
          url: tab.url || "",
          container: tab.cookieStoreId || "",
        }));

        console.log("Formatted Claude tabs:", formattedTabs);

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
        console.log("No tabs found with main method, trying fallback...");

        // Fallback: query trực tiếp với URL pattern
        try {
          const directTabs = await browserAPI.tabs.query({
            url: ["https://claude.ai/*", "https://*.claude.ai/*"],
          });

          console.log(
            "Fallback direct query found:",
            directTabs.length,
            "tabs"
          );
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
  browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background: Received message:", request);

    (async () => {
      try {
        switch (request.action) {
          case "getClaudeTabs":
            console.log("Background: Processing getClaudeTabs");
            const tabs = await claudeManager.getClaudeTabs();
            console.log("Background: Found tabs:", tabs.length);

            const response = {
              success: true,
              tabs: tabs.map((tab) => ({
                id: tab.id,
                title: tab.title || "Untitled",
                url: tab.url || "",
                container: tab.cookieStoreId || "",
              })),
            };

            console.log("Background: Sending response:", response);
            sendResponse(response);
            break;

          case "sendPrompt":
            console.log("Background: Processing sendPrompt");
            const result = await claudeManager.sendPromptToTab(
              request.tabId,
              request.prompt
            );
            console.log("Background: Send prompt result:", result);
            sendResponse(result);
            break;

          default:
            console.log("Background: Unknown action:", request.action);
            sendResponse({ success: false, error: "Unknown action" });
        }
      } catch (error) {
        console.error("Background: Error handling message:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep message channel open for async response
  });

  console.log("Claude Assistant background script loaded");
})();
