// File: src/background/service-worker.ts
import { TabManager } from "./tab-manager";
import { FocusedTabsManager } from "./focused-tabs-manager";
import { ProxyManager } from "./proxy-manager";
import { MessageHandler } from "./message-handler";
import { setupEventListeners } from "./event-listeners";
import { SessionManager } from "./session-manager";

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
  const sessionManager = new SessionManager(browserAPI);
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
    messageHandler,
    sessionManager
  );

  // Expose managers for content scripts and popup
  (globalThis as any).tabManager = tabManager;
  (globalThis as any).sessionManager = sessionManager;
})();
