// File: src/background/event-listeners.ts
import { TabManager } from "./tab-manager";
import { FocusedTabsManager } from "./focused-tabs-manager";
import { ProxyManager } from "./proxy-manager";
import { MessageHandler } from "./message-handler";

export function setupEventListeners(
  browserAPI: any,
  tabManager: TabManager,
  focusedTabsManager: FocusedTabsManager,
  proxyManager: ProxyManager,
  messageHandler: MessageHandler
): void {
  // Handle extension installation
  browserAPI.runtime.onInstalled.addListener(async (details: any) => {
    if (details.reason === "install") {
      await tabManager.initializeDefaultGroups();
    }
  });

  // Message listener
  browserAPI.runtime.onMessage.addListener(
    (message: any, sender: any, sendResponse: any) => {
      // ✅ FIX: Sử dụng sendResponse callback cho Firefox manifest v2
      messageHandler.handleMessage(message, sendResponse);
      // ✅ Return true để giữ message channel mở cho async operation
      return true;
    }
  );

  // Tab activated
  browserAPI.tabs.onActivated.addListener(async (activeInfo: any) => {
    try {
    } catch (error) {
      console.error(
        "[EventListeners] ❌ Failed to handle tab activation:",
        error
      );
    }
  });

  // Tab removal cleanup
  browserAPI.tabs.onRemoved.addListener(async (tabId: number) => {
    try {
      // Clean up proxy assignment when tab is closed
      await proxyManager.cleanupTabProxy(tabId);
      // Clean up focused tab if this tab was focused
      await focusedTabsManager.removeFocusedTab(tabId);
    } catch (error) {
      console.error(
        "[EventListeners] Failed to clean up for closed tab:",
        error
      );
    }
  });
}
