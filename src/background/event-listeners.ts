// File: src/background/event-listeners.ts
import { TabManager } from "./tab-manager";
import { FocusedTabsManager } from "./focused-tabs-manager";
import { ProxyManager } from "./proxy-manager";
import { MessageHandler } from "./message-handler";
import { SessionManager } from "./session-manager";

export function setupEventListeners(
  browserAPI: any,
  tabManager: TabManager,
  focusedTabsManager: FocusedTabsManager,
  proxyManager: ProxyManager,
  messageHandler: MessageHandler,
  sessionManager: SessionManager
): void {
  // Handle extension installation
  browserAPI.runtime.onInstalled.addListener(async (details: any) => {
    if (details.reason === "install") {
      await tabManager.initializeDefaultGroups();
    } else if (details.reason === "update") {
      // ✅ THÊM: Restore từ session backup sau khi update
      console.log(
        "[EventListeners] 🔄 Extension updated, restoring session..."
      );
      const session = await sessionManager.restoreSession();
      if (session) {
        // Load groups hiện tại từ storage
        const result = await browserAPI.storage.local.get([
          "tabGroups",
          "activeGroupId",
        ]);
        const currentGroups = result.tabGroups || [];

        // Nếu không có groups trong storage, restore từ session
        if (currentGroups.length === 0 && session.groups.length > 0) {
          console.log(
            `[EventListeners] ✅ Restoring ${session.groups.length} groups from session`
          );
          await browserAPI.storage.local.set({
            tabGroups: session.groups,
            activeGroupId: session.activeGroupId,
          });

          // Reload tab manager
          await tabManager.reloadFromStorage();
        }
      }
    }
  });

  browserAPI.runtime.onStartup.addListener(async () => {
    console.log("[EventListeners] 🚀 Browser started, checking session...");

    const session = await sessionManager.restoreSession();
    if (session) {
      // Load groups hiện tại từ storage
      const result = await browserAPI.storage.local.get([
        "tabGroups",
        "activeGroupId",
      ]);
      const currentGroups = result.tabGroups || [];

      // Nếu không có groups trong storage, restore từ session
      if (currentGroups.length === 0 && session.groups.length > 0) {
        console.log(
          `[EventListeners] ✅ Restoring ${session.groups.length} groups from session`
        );
        await browserAPI.storage.local.set({
          tabGroups: session.groups,
          activeGroupId: session.activeGroupId,
        });

        // Reload tab manager
        await tabManager.reloadFromStorage();
      } else {
        console.log(
          "[EventListeners] ℹ️ Groups already exist in storage, skipping restore"
        );
      }
    }
  });

  // Message listener
  browserAPI.runtime.onMessage.addListener(
    (message: any, _sender: any, sendResponse: any) => {
      // ✅ FIX: Sử dụng sendResponse callback cho Firefox manifest v2
      messageHandler.handleMessage(message, sendResponse);
      // ✅ Return true để giữ message channel mở cho async operation
      return true;
    }
  );

  // Tab activated
  browserAPI.tabs.onActivated.addListener(async () => {
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
