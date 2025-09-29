// File: src/background/service-worker.ts
import { TabManager } from './tab-manager';

(function () {
  "use strict";

  const browserAPI = (function (): typeof chrome & any {
    if (typeof browser !== "undefined") return browser as any;
    if (typeof chrome !== "undefined") return chrome as any;
    throw new Error("No browser API available");
  })();

  // Initialize the tab manager
  new TabManager(browserAPI);
})();