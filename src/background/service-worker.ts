// File: src/background/service-worker.ts
import { TabManager } from "./tab-manager";
import { FocusedTabsManager } from "./focused-tabs-manager";
import { ProxyManager } from "./proxy-manager";
import { WebSocketManager } from "./websocket-manager";
import { WebSocketClient } from "./websocket-client";
import { MessageHandler } from "./message-handler";
import { setupEventListeners } from "./event-listeners";

declare const browser: typeof chrome & any;

(function () {
  "use strict";

  const browserAPI = (function (): typeof chrome & any {
    if (typeof browser !== "undefined") return browser as any;
    if (typeof chrome !== "undefined") return chrome as any;
    throw new Error("No browser API available");
  })();

  // Initialize managers
  const tabManager = new TabManager(browserAPI);
  const focusedTabsManager = new FocusedTabsManager(browserAPI);
  const proxyManager = new ProxyManager(browserAPI);
  const websocketManager = new WebSocketManager();
  const websocketClient = new WebSocketClient(browserAPI);
  const messageHandler = new MessageHandler(
    tabManager,
    focusedTabsManager,
    proxyManager
  );

  // Setup all event listeners
  setupEventListeners(
    browserAPI,
    tabManager,
    focusedTabsManager,
    proxyManager,
    websocketManager,
    websocketClient,
    messageHandler
  );

  // Start WebSocket connection to VSCode
  websocketClient.connect();

  // Expose managers for content scripts and popup
  (globalThis as any).tabManager = tabManager;
  (globalThis as any).websocketClient = websocketClient;

  console.debug("[ServiceWorker] ✅ Initialized successfully");
})();
