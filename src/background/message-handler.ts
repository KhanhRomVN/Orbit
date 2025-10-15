// File: src/background/message-handler.ts
import { TabManager } from "./tab-manager";
import { FocusedTabsManager } from "./focused-tabs-manager";
import { ProxyManager } from "./proxy-manager";

export class MessageHandler {
  constructor(
    private tabManager: TabManager,
    private focusedTabsManager: FocusedTabsManager,
    private proxyManager: ProxyManager
  ) {}

  async handleMessage(
    message: any,
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      let result: any;

      switch (message.action) {
        case "setActiveGroup":
          await this.tabManager.setActiveGroup(message.groupId);
          result = { success: true };
          break;

        case "createGroup": {
          try {
            const newGroup = await this.tabManager.createGroup(
              message.groupData
            );

            if (!newGroup || !newGroup.id) {
              console.error(
                "[MessageHandler] ❌ Invalid group response:",
                newGroup
              );
              throw new Error("Failed to create group - invalid response");
            }
            result = newGroup;
          } catch (error) {
            console.error("[MessageHandler] ❌ createGroup error:", error);
            throw error;
          }
          break;
        }

        case "deleteGroup":
          await this.tabManager.deleteGroup(message.groupId);
          result = { success: true };
          break;

        case "createTabInGroup":
          result = await this.tabManager.createTabInGroup(
            message.groupId,
            message.url
          );
          break;

        case "getContainers":
          result = await this.tabManager.getContainers();
          break;

        case "applyGroupProxy":
          result = await this.proxyManager.applyGroupProxy(
            message.groupId,
            message.proxyId
          );
          break;

        case "applyTabProxy":
          result = await this.proxyManager.applyTabProxy(
            message.tabId,
            message.proxyId
          );
          break;

        case "setTabFocus":
          result = await this.focusedTabsManager.setTabFocus(
            message.tabId,
            message.containerId
          );
          break;

        case "removeTabFocus":
          await this.focusedTabsManager.removeFocusedTab(message.tabId);

          if (message.containerId) {
            chrome.runtime.sendMessage({
              action: "focusChanged",
              containerId: message.containerId,
              focusedTabId: null,
            });
          }

          result = { success: true };
          break;

        case "getFocusedTab":
          const focusedTabId =
            await this.focusedTabsManager.getFocusedTabForContainer(
              message.containerId
            );
          result = { focusedTabId };
          break;

        case "reloadAfterImport":
          console.log("[MessageHandler] 🔄 Reload after import requested");
          // Reload groups từ storage
          await this.tabManager.reloadFromStorage();
          result = { success: true };
          break;

        default:
          console.warn(
            `[MessageHandler] ⚠️ Unknown message action: ${message.action}`
          );
          result = { error: `Unknown action: ${message.action}` };
      }

      sendResponse(result);
    } catch (error) {
      console.error("[MessageHandler] Message handler error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      sendResponse({ error: errorMessage });
    }
  }
}
