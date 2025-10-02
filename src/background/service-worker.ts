import { TabManager } from "./tab-manager";

declare const browser: typeof chrome & any;

(function () {
  "use strict";

  const browserAPI = (function (): typeof chrome & any {
    if (typeof browser !== "undefined") return browser as any;
    if (typeof chrome !== "undefined") return chrome as any;
    throw new Error("No browser API available");
  })();

  // Initialize the tab manager
  const tabManager = new TabManager(browserAPI);

  // Handle extension installation
  browserAPI.runtime.onInstalled.addListener(async (details: any) => {
    if (details.reason === "install") {
      await tabManager.initializeDefaultGroups();
    }
  });

  browserAPI.runtime.onMessage.addListener(
    (message: any, _sender: any, sendResponse: any) => {
      const handleMessage = async () => {
        try {
          let result: any;

          switch (message.action) {
            case "setActiveGroup":
              await tabManager.setActiveGroup(message.groupId);
              result = { success: true };
              break;

            case "createGroup": {
              const newGroup = await tabManager.createGroup(message.groupData);
              if (!newGroup || !newGroup.id) {
                throw new Error("Failed to create group - invalid response");
              }
              result = newGroup;
              break;
            }

            case "createTabInGroup":
              result = await tabManager.createTabInGroup(
                message.groupId,
                message.url
              );
              break;
          }

          return result;
        } catch (error) {
          console.error("[DEBUG] Message handler error:", error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return { error: errorMessage };
        }
      };

      // Xử lý promise và gọi sendResponse
      handleMessage().then(sendResponse);

      // QUAN TRỌNG: Return true để giữ message channel
      return true;
    }
  );

  // Expose tab manager for content scripts and popup
  (globalThis as any).tabManager = tabManager;
})();
