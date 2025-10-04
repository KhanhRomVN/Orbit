// File: src/background/event-listeners.ts
import { TabManager } from "./tab-manager";
import { FocusedTabsManager } from "./focused-tabs-manager";
import { ProxyManager } from "./proxy-manager";
import { WebSocketManager } from "./websocket-manager";
import { WebSocketClient } from "./websocket-client";
import { MessageHandler } from "./message-handler";

export function setupEventListeners(
  browserAPI: any,
  tabManager: TabManager,
  focusedTabsManager: FocusedTabsManager,
  proxyManager: ProxyManager,
  websocketManager: WebSocketManager,
  websocketClient: WebSocketClient,
  messageHandler: MessageHandler
): void {
  // Set browser API for WebSocket manager
  websocketManager.setBrowserAPI(browserAPI);

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
      console.debug("[EventListeners] 🎯 Tab activated:", activeInfo.tabId);
      // TabManager automatically updates active state in handleTabActivated()
      console.debug("[EventListeners] ✅ Tab activation handled");
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

  // Listen for focused tab changes
  browserAPI.storage.onChanged.addListener((changes: any, areaName: string) => {
    if (areaName === "local") {
      // Focused tabs changed
      if (changes["orbit-focused-tabs"]) {
        websocketClient.sendFocusedTabInfo();
      }
      // Active group changed
      if (changes["activeGroupId"]) {
        websocketClient.sendFocusedTabInfo();
      }
    }
  });

  // WebSocket event forwarding
  setupWebSocketEvents(browserAPI, websocketManager);
}

function setupWebSocketEvents(
  browserAPI: any,
  websocketManager: WebSocketManager
): void {
  // Tab created event
  browserAPI.tabs.onCreated.addListener((tab: any) => {
    websocketManager.sendTabCreated(tab);
  });

  // Tab removed event
  browserAPI.tabs.onRemoved.addListener((tabId: number) => {
    websocketManager.sendTabRemoved(tabId);
  });

  // Tab updated event
  browserAPI.tabs.onUpdated.addListener(
    (tabId: number, changeInfo: any, tab: any) => {
      websocketManager.sendTabUpdated(tabId, changeInfo, tab);
    }
  );

  // Group changed event
  browserAPI.storage.onChanged.addListener((changes: any, areaName: string) => {
    if (areaName === "local" && changes.tabGroups) {
      websocketManager.sendGroupsChanged(changes.tabGroups.newValue);
    }
  });
}
