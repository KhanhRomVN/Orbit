// File: src/background/service-worker.ts
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
              console.log(
                "[ServiceWorker] 📥 Received createGroup request:",
                message.groupData
              );
              try {
                const newGroup = await tabManager.createGroup(
                  message.groupData
                );
                console.log("[ServiceWorker] ✅ Group created:", newGroup);

                if (!newGroup || !newGroup.id) {
                  console.error(
                    "[ServiceWorker] ❌ Invalid group response:",
                    newGroup
                  );
                  throw new Error("Failed to create group - invalid response");
                }
                result = newGroup;
              } catch (error) {
                console.error("[ServiceWorker] ❌ createGroup error:", error);
                throw error;
              }
              break;
            }

            case "createTabInGroup":
              result = await tabManager.createTabInGroup(
                message.groupId,
                message.url
              );
              break;

            case "getContainers":
              result = await tabManager.getContainers();
              break;

            case "applyGroupProxy":
              result = await applyGroupProxy(message.groupId, message.proxyId);
              break;

            case "applyTabProxy":
              result = await applyTabProxy(message.tabId, message.proxyId);
              break;
          }

          console.log("[ServiceWorker] 📤 Returning result:", result);
          return result;
        } catch (error) {
          console.error("[DEBUG] Message handler error:", error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return { error: errorMessage };
        }
      };

      // Handle promise and call sendResponse
      handleMessage().then(sendResponse);

      // IMPORTANT: Return true to keep message channel open
      return true;
    }
  );

  // Expose tab manager for content scripts and popup
  (globalThis as any).tabManager = tabManager;

  browserAPI.tabs.onActivated.addListener(async (activeInfo: any) => {
    try {
      console.debug("[ServiceWorker] 🎯 Tab activated:", activeInfo.tabId);

      // DON'T reload groups here to avoid race condition with saveGroups()
      // TabManager automatically updates active state in handleTabActivated()

      console.debug("[ServiceWorker] ✅ Tab activation handled");
    } catch (error) {
      console.error(
        "[ServiceWorker] ❌ Failed to handle tab activation:",
        error
      );
    }
  });

  // ====================================================================
  // PROXY HANDLER FUNCTIONS
  // ====================================================================

  async function applyGroupProxy(groupId: string, proxyId: string | null) {
    try {
      const group = tabManager.getGroups().find((g: any) => g.id === groupId);

      if (!group) {
        throw new Error("Group not found");
      }

      // Get proxy configuration if proxyId is provided
      let proxyConfig = null;
      if (proxyId) {
        const result = await browserAPI.storage.local.get(["sigil-proxies"]);
        const proxies = result["sigil-proxies"] || [];
        proxyConfig = proxies.find((p: any) => p.id === proxyId);

        if (!proxyConfig) {
          throw new Error("Proxy not found");
        }
      }

      // Apply proxy to all tabs in group
      for (const tab of group.tabs) {
        if (tab.id) {
          await applyProxyToTab(tab.id, proxyConfig);
        }
      }

      console.log(
        `[ServiceWorker] ✅ Applied proxy to group: ${groupId}`,
        proxyConfig ? `(${proxyConfig.name})` : "(removed)"
      );

      return { success: true };
    } catch (error) {
      console.error("[ServiceWorker] ❌ Failed to apply group proxy:", error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  async function applyTabProxy(tabId: number, proxyId: string | null) {
    try {
      let proxyConfig = null;
      if (proxyId) {
        const result = await browserAPI.storage.local.get(["sigil-proxies"]);
        const proxies = result["sigil-proxies"] || [];
        proxyConfig = proxies.find((p: any) => p.id === proxyId);

        if (!proxyConfig) {
          throw new Error("Proxy not found");
        }
      }

      await applyProxyToTab(tabId, proxyConfig);

      console.log(
        `[ServiceWorker] ✅ Applied proxy to tab: ${tabId}`,
        proxyConfig ? `(${proxyConfig.name})` : "(removed)"
      );

      return { success: true };
    } catch (error) {
      console.error("[ServiceWorker] ❌ Failed to apply tab proxy:", error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  async function applyProxyToTab(tabId: number, proxyConfig: any) {
    // Firefox implementation using webRequest
    if (browserAPI.webRequest) {
      if (proxyConfig) {
        // Apply proxy configuration
        const proxyInfo: any = {
          type: proxyConfig.type,
          host: proxyConfig.address,
          port: proxyConfig.port,
        };

        if (proxyConfig.username && proxyConfig.password) {
          proxyInfo.username = proxyConfig.username;
          proxyInfo.password = proxyConfig.password;
        }

        // Store proxy info for this tab in session storage
        try {
          await browserAPI.storage.session.set({
            [`proxy_${tabId}`]: proxyInfo,
          });
          console.log(
            `[ServiceWorker] 📝 Stored proxy config for tab ${tabId}`
          );
        } catch (error) {
          // Fallback to local storage if session storage not available
          await browserAPI.storage.local.set({
            [`proxy_${tabId}`]: proxyInfo,
          });
          console.log(
            `[ServiceWorker] 📝 Stored proxy config for tab ${tabId} (local)`
          );
        }
      } else {
        // Remove proxy configuration
        try {
          await browserAPI.storage.session.remove([`proxy_${tabId}`]);
        } catch (error) {
          await browserAPI.storage.local.remove([`proxy_${tabId}`]);
        }
        console.log(`[ServiceWorker] 🗑️ Removed proxy config for tab ${tabId}`);
      }
    } else if (browserAPI.proxy) {
      // Chrome implementation
      // Note: Chrome's proxy API works globally or per-profile, not per-tab
      // For true per-tab proxy, you'd need to use a PAC script
      console.warn(
        "[ServiceWorker] ⚠️ Chrome per-tab proxy requires PAC script implementation"
      );

      // Store proxy assignment for potential PAC script usage
      if (proxyConfig) {
        await browserAPI.storage.local.set({
          [`proxy_${tabId}`]: {
            type: proxyConfig.type,
            host: proxyConfig.address,
            port: proxyConfig.port,
            username: proxyConfig.username,
            password: proxyConfig.password,
          },
        });
      } else {
        await browserAPI.storage.local.remove([`proxy_${tabId}`]);
      }
    }
  }

  // Optional: Listen for tab removal to clean up proxy assignments
  browserAPI.tabs.onRemoved.addListener(async (tabId: number) => {
    try {
      // Clean up proxy assignment when tab is closed
      await browserAPI.storage.local.remove([`proxy_${tabId}`]);
      try {
        await browserAPI.storage.session.remove([`proxy_${tabId}`]);
      } catch (error) {
        // Session storage might not be available
      }
    } catch (error) {
      console.error(
        "[ServiceWorker] Failed to clean up proxy for closed tab:",
        error
      );
    }
  });

  // Optional: Setup proxy request handler for Firefox
  // ====================================================================
  // FIREFOX PROXY HANDLER - Apply per-tab proxy via webRequest
  // ====================================================================
  if (browserAPI.webRequest && browserAPI.webRequest.onBeforeRequest) {
    console.log("[ServiceWorker] 🌐 Setting up webRequest proxy handler...");

    // Listener để apply proxy cho từng tab
    browserAPI.webRequest.onBeforeRequest.addListener(
      async (details: any) => {
        const tabId = details.tabId;
        if (tabId === -1) return {}; // Skip system requests

        try {
          // Lấy proxy config cho tab này
          let proxyInfo = null;
          try {
            const sessionResult = await browserAPI.storage.session.get([
              `proxy_${tabId}`,
            ]);
            proxyInfo = sessionResult[`proxy_${tabId}`];
          } catch {
            const localResult = await browserAPI.storage.local.get([
              `proxy_${tabId}`,
            ]);
            proxyInfo = localResult[`proxy_${tabId}`];
          }

          if (!proxyInfo) return {}; // No proxy for this tab

          // Apply proxy cho request này
          const proxyConfig: any = {
            type: proxyInfo.type,
            host: proxyInfo.host,
            port: proxyInfo.port,
          };

          if (proxyInfo.username && proxyInfo.password) {
            proxyConfig.username = proxyInfo.username;
            proxyConfig.password = proxyInfo.password;
          }

          console.log(
            `[ServiceWorker] 🌐 Routing request via proxy for tab ${tabId}:`,
            details.url
          );

          return { type: "proxy", proxyInfo: [proxyConfig] };
        } catch (error) {
          console.error(
            `[ServiceWorker] ❌ Error applying proxy for tab ${tabId}:`,
            error
          );
          return {};
        }
      },
      { urls: ["<all_urls>"] },
      ["blocking"]
    );

    console.log("[ServiceWorker] ✅ webRequest proxy handler installed");
  }

  console.log(
    "[ServiceWorker] 🚀 Service worker initialized with proxy support"
  );
})();
