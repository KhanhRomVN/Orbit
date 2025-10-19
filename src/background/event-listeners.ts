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
      console.log(
        "[EventListeners] 🔄 Extension updated, preserving session..."
      );
      // Không xóa gì cả, giữ nguyên data
    }
  });

  browserAPI.runtime.onStartup.addListener(async () => {
    console.log("[EventListeners] 🚀 Browser started, cleaning state...");

    // ✅ CRITICAL: Set flag để KHÔNG lưu session trong quá trình cleanup
    sessionManager.setRestoringSession(false); // Reset để clear được
    sessionManager.setStartupMode(true);

    // ✅ BƯỚC 1: XÓA TOÀN BỘ GROUPS VÀ TABS HIỆN TẠI
    console.log("[EventListeners] 🧹 Clearing all groups and tabs...");

    const allTabs = await browserAPI.tabs.query({});
    const restrictedUrlPrefixes = [
      "about:",
      "chrome:",
      "chrome-extension:",
      "moz-extension:",
      "edge:",
      "opera:",
      "brave:",
      "vivaldi:",
    ];

    const tabsToClose = allTabs.filter((tab: any) => {
      if (!tab.url) return false;
      return !restrictedUrlPrefixes.some((prefix) =>
        tab.url.startsWith(prefix)
      );
    });

    if (tabsToClose.length > 0) {
      try {
        await browserAPI.tabs.remove(tabsToClose.map((t: any) => t.id));
        console.log(`[EventListeners] ✅ Closed ${tabsToClose.length} tabs`);
      } catch (error) {
        console.error("[EventListeners] ❌ Failed to close tabs:", error);
      }
    }

    await browserAPI.storage.local.set({
      tabGroups: [],
      activeGroupId: null,
    });

    console.log("[EventListeners] ✅ Clean state prepared");
    sessionManager.setStartupMode(false);
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
