// File: src/background/service-worker.ts
import { TabManager } from "./tab-manager";
import { FocusedTabInfo } from "../types/tab-group";

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

  // Storage key for focused tabs
  const FOCUSED_TABS_KEY = "orbit-focused-tabs";

  // Helper functions for focused tabs
  async function getFocusedTabs(): Promise<FocusedTabInfo[]> {
    const result = await browserAPI.storage.local.get([FOCUSED_TABS_KEY]);
    return result[FOCUSED_TABS_KEY] || [];
  }

  async function setFocusedTab(
    containerId: string,
    tabId: number
  ): Promise<void> {
    const focusedTabs = await getFocusedTabs();
    console.debug(`[ServiceWorker] 📦 Current focused tabs:`, focusedTabs);

    // Remove old focus for this container
    const filtered = focusedTabs.filter((f) => f.containerId !== containerId);

    // Add new focus
    const newFocusInfo = {
      containerId,
      tabId,
      timestamp: Date.now(),
    };
    filtered.push(newFocusInfo);

    console.debug(`[ServiceWorker] 💾 Saving focused tabs:`, filtered);
    await browserAPI.storage.local.set({ [FOCUSED_TABS_KEY]: filtered });

    // Verify save
    const verify = await browserAPI.storage.local.get([FOCUSED_TABS_KEY]);
    console.debug(
      `[ServiceWorker] ✅ Verified saved data:`,
      verify[FOCUSED_TABS_KEY]
    );
  }

  async function removeFocusedTab(
    tabId: number,
    containerId?: string
  ): Promise<string | undefined> {
    const focusedTabs = await getFocusedTabs();
    const filtered = focusedTabs.filter((f) => f.tabId !== tabId);
    await browserAPI.storage.local.set({ [FOCUSED_TABS_KEY]: filtered });

    // Return containerId for broadcasting (nếu có)
    return containerId;
  }

  async function getFocusedTabForContainer(
    containerId: string
  ): Promise<number | null> {
    const focusedTabs = await getFocusedTabs();
    console.debug(`[ServiceWorker] 🔍 getFocusedTabForContainer:`, {
      containerId,
      allFocusedTabs: focusedTabs,
    });

    const focused = focusedTabs.find((f) => f.containerId === containerId);
    console.debug(`[ServiceWorker] 📌 Found focused tab:`, focused);

    const result = focused?.tabId || null;
    console.debug(`[ServiceWorker] 📤 Returning focusedTabId:`, result);
    return result;
  }

  // Handle extension installation
  browserAPI.runtime.onInstalled.addListener(async (details: any) => {
    if (details.reason === "install") {
      await tabManager.initializeDefaultGroups();
    }
  });

  browserAPI.runtime.onMessage.addListener(
    (message: any, _sender: any, sendResponse: any) => {
      // ✅ FIX: Sử dụng sendResponse callback cho Firefox manifest v2
      (async () => {
        try {
          let result: any;

          switch (message.action) {
            case "setActiveGroup":
              await tabManager.setActiveGroup(message.groupId);
              result = { success: true };
              break;

            case "createGroup": {
              try {
                const newGroup = await tabManager.createGroup(
                  message.groupData
                );

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

            case "setTabFocus":
              const focusResult = await setTabFocus(
                message.tabId,
                message.containerId
              );
              result = focusResult;
              break;

            case "removeTabFocus":
              await removeFocusedTab(message.tabId);

              // ✅ THÊM: Broadcast focus removed
              if (message.containerId) {
                browserAPI.runtime
                  .sendMessage({
                    action: "focusChanged",
                    containerId: message.containerId,
                    focusedTabId: null,
                  })
                  .catch(() => {
                    console.debug(
                      "[ServiceWorker] No receivers for focusChanged (expected)"
                    );
                  });
              }

              result = { success: true };
              break;

            case "getFocusedTab":
              const focusedTabId = await getFocusedTabForContainer(
                message.containerId
              );
              result = { focusedTabId };
              console.debug(
                `[ServiceWorker] 📨 getFocusedTab returning:`,
                result
              );
              break;
          }

          console.debug(
            `[ServiceWorker] 📤 Final result being sent via sendResponse:`,
            result
          );

          // ✅ Gửi kết quả qua sendResponse callback
          sendResponse(result);
        } catch (error) {
          console.error("[DEBUG] Message handler error:", error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          sendResponse({ error: errorMessage });
        }
      })();

      // ✅ Return true để giữ message channel mở cho async operation
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
  // TAB FOCUS MANAGEMENT
  // ====================================================================
  async function setTabFocus(tabId: number, containerId: string) {
    try {
      console.debug(`[ServiceWorker] 🎯 setTabFocus called:`, {
        tabId,
        containerId,
      });

      // Kiểm tra tab có tồn tại và có đúng URL claude.ai không
      const tab = await browserAPI.tabs.get(tabId);
      console.debug(`[ServiceWorker] 📋 Tab info:`, {
        id: tab.id,
        url: tab.url,
        cookieStoreId: tab.cookieStoreId,
      });

      if (!tab.url || !tab.url.includes("claude.ai")) {
        const errorMsg = "Tab is not a Claude.ai tab";
        console.error(`[ServiceWorker] ❌ ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      if (tab.cookieStoreId !== containerId) {
        const errorMsg = `Tab container mismatch: expected ${containerId}, got ${tab.cookieStoreId}`;
        console.error(`[ServiceWorker] ❌ ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      await setFocusedTab(containerId, tabId);
      console.debug(`[ServiceWorker] ✅ Focus set in storage for tab ${tabId}`);

      // Broadcast focus change
      browserAPI.runtime
        .sendMessage({
          action: "focusChanged",
          containerId,
          focusedTabId: tabId,
        })
        .catch(() => {
          console.debug(
            "[ServiceWorker] No receivers for focusChanged (expected)"
          );
        });

      console.debug(`[ServiceWorker] ✅ setTabFocus completed successfully`);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ServiceWorker] ❌ Failed to set tab focus:`, {
        error: errorMsg,
        tabId,
        containerId,
      });
      return { success: false, error: errorMsg };
    }
  }

  // ====================================================================
  // PROXY HANDLER FUNCTIONS
  // ====================================================================
  async function applyGroupProxy(groupId: string, proxyId: string | null) {
    try {
      const group = tabManager.getGroups().find((g: any) => g.id === groupId);

      if (!group) {
        throw new Error("Group not found");
      }

      // CHỈ áp dụng cho container group
      if (group.type !== "container" || !group.containerId) {
        throw new Error("Can only assign proxy to container groups");
      }

      const containerId = group.containerId;

      if (proxyId) {
        // Get proxy configuration
        const result = await browserAPI.storage.local.get(["orbit-proxies"]);
        const proxies = result["orbit-proxies"] || [];
        const proxyConfig = proxies.find((p: any) => p.id === proxyId);

        if (!proxyConfig) {
          throw new Error("Proxy not found");
        }

        // Lấy danh sách container hiện tại của proxy này
        const assignmentsResult = await browserAPI.storage.local.get([
          "orbit-proxy-assignments",
        ]);
        const assignments = assignmentsResult["orbit-proxy-assignments"] || [];

        let assignment = assignments.find((a: any) => a.proxyId === proxyId);

        if (assignment && assignment.containerIds) {
          // Thêm container vào list nếu chưa có
          if (!assignment.containerIds.includes(containerId)) {
            assignment.containerIds.push(containerId);
          }
        } else {
          // Tạo assignment mới
          assignments.push({ containerIds: [containerId], proxyId });
        }

        await browserAPI.storage.local.set({
          "orbit-proxy-assignments": assignments,
        });
      } else {
        // Remove container từ tất cả proxy assignments
        const assignmentsResult = await browserAPI.storage.local.get([
          "orbit-proxy-assignments",
        ]);
        const assignments = assignmentsResult["orbit-proxy-assignments"] || [];

        for (const assignment of assignments) {
          if (
            assignment.containerIds &&
            assignment.containerIds.includes(containerId)
          ) {
            assignment.containerIds = assignment.containerIds.filter(
              (id: string) => id !== containerId
            );

            // Nếu không còn container nào, xóa assignment
            if (assignment.containerIds.length === 0) {
              const filtered = assignments.filter(
                (a: any) => a.proxyId !== assignment.proxyId
              );
              await browserAPI.storage.local.set({
                "orbit-proxy-assignments": filtered,
              });
              return { success: true };
            }
          }
        }

        await browserAPI.storage.local.set({
          "orbit-proxy-assignments": assignments,
        });
      }

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
        const result = await browserAPI.storage.local.get(["orbit-proxies"]);
        const proxies = result["orbit-proxies"] || [];
        proxyConfig = proxies.find((p: any) => p.id === proxyId);

        if (!proxyConfig) {
          throw new Error("Proxy not found");
        }
      }

      await applyProxyToTab(tabId, proxyConfig);

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
        } catch (error) {
          // Fallback to local storage if session storage not available
          await browserAPI.storage.local.set({
            [`proxy_${tabId}`]: proxyInfo,
          });
        }
      } else {
        // Remove proxy configuration
        try {
          await browserAPI.storage.session.remove([`proxy_${tabId}`]);
        } catch (error) {
          await browserAPI.storage.local.remove([`proxy_${tabId}`]);
        }
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

      // Clean up focused tab if this tab was focused
      await removeFocusedTab(tabId);
    } catch (error) {
      console.error(
        "[ServiceWorker] Failed to clean up for closed tab:",
        error
      );
    }
  });

  // ====================================================================
  // FIREFOX PROXY HANDLER - Apply per-tab proxy via proxy.onRequest
  // ====================================================================
  if (browserAPI.proxy && browserAPI.proxy.onRequest) {
    browserAPI.proxy.onRequest.addListener(
      (requestInfo: any) => {
        const tabId = requestInfo.tabId;
        // Skip system requests
        if (tabId === -1 || tabId === undefined) {
          return { type: "direct" };
        }

        // ✅ QUAN TRỌNG: Return Promise để Firefox đợi
        return new Promise(async (resolve) => {
          try {
            // Lấy thông tin tab
            const tab = await browserAPI.tabs.get(tabId);
            if (!tab) {
              resolve({ type: "direct" });
              return;
            }

            // Lấy proxy assignments và proxies
            const result = await browserAPI.storage.local.get([
              "orbit-proxy-assignments",
              "orbit-proxies",
            ]);
            const assignments = result["orbit-proxy-assignments"] || [];
            const proxies = result["orbit-proxies"] || [];

            // Priority 1: Tab-specific proxy
            let proxyAssignment = assignments.find(
              (a: any) => a.tabId === tabId
            );

            // Priority 2: Container proxy
            if (
              !proxyAssignment &&
              tab.cookieStoreId &&
              tab.cookieStoreId !== "firefox-default"
            ) {
              proxyAssignment = assignments.find(
                (a: any) =>
                  a.containerIds && a.containerIds.includes(tab.cookieStoreId)
              );
            }

            // Nếu không có proxy assignment, dùng direct connection
            if (!proxyAssignment) {
              resolve({ type: "direct" });
              return;
            }

            // Lấy proxy config
            const proxyConfig = proxies.find(
              (p: any) => p.id === proxyAssignment.proxyId
            );

            if (!proxyConfig) {
              console.warn(
                `[ServiceWorker] ⚠️ Proxy config not found for ID: ${proxyAssignment.proxyId}`
              );
              resolve({ type: "direct" });
              return;
            }

            // Map type từ config sang Firefox proxy type
            let proxyType = proxyConfig.type;
            if (proxyType === "https") {
              proxyType = "http";
            }
            // ✅ CRITICAL: Firefox dùng "socks" cho SOCKS5, không phải "socks5"
            if (proxyType === "socks5") {
              proxyType = "socks";
            }

            // Build proxy response
            const proxyResponse: any = {
              type: proxyType,
              host: proxyConfig.address,
              port: proxyConfig.port,
              proxyDNS: true, // ✅ QUAN TRỌNG: DNS cũng đi qua proxy
              failoverTimeout: 5, // Timeout 5s nếu proxy không phản hồi
            };

            // ✅ Thêm credentials cho SOCKS5
            if (
              proxyType === "socks" &&
              proxyConfig.username &&
              proxyConfig.password
            ) {
              proxyResponse.username = proxyConfig.username;
              proxyResponse.password = proxyConfig.password;
            }

            resolve(proxyResponse);
          } catch (error) {
            console.error(
              `[ServiceWorker] ❌ Error in proxy handler for tab ${tabId}:`,
              error
            );
            resolve({ type: "direct" });
          }
        });
      },
      { urls: ["<all_urls>"] }
    );
  } else {
    console.warn(
      "[ServiceWorker] ⚠️ browser.proxy.onRequest not available - per-tab proxy will not work"
    );
  }

  // ====================================================================
  // PROXY AUTHENTICATION HANDLER
  // ====================================================================
  if (browserAPI.webRequest && browserAPI.webRequest.onAuthRequired) {
    browserAPI.webRequest.onAuthRequired.addListener(
      async (details: any) => {
        // Get tab info
        try {
          const tab = await browserAPI.tabs.get(details.tabId);
          if (!tab) {
            return { cancel: false };
          }

          // Get proxy assignments
          const result = await browserAPI.storage.local.get([
            "orbit-proxy-assignments",
            "orbit-proxies",
          ]);
          const assignments = result["orbit-proxy-assignments"] || [];
          const proxies = result["orbit-proxies"] || [];

          // Priority 1: Tab-specific proxy
          let proxyAssignment = assignments.find(
            (a: any) => a.tabId === details.tabId
          );

          if (
            !proxyAssignment &&
            tab.cookieStoreId &&
            tab.cookieStoreId !== "firefox-default"
          ) {
            proxyAssignment = assignments.find(
              (a: any) =>
                a.containerIds && a.containerIds.includes(tab.cookieStoreId)
            );
          }

          if (!proxyAssignment) {
            return { cancel: false };
          }

          // Get proxy config
          const proxyConfig = proxies.find(
            (p: any) => p.id === proxyAssignment.proxyId
          );

          if (!proxyConfig) {
            return { cancel: false };
          }

          // Return credentials if available
          if (proxyConfig.username && proxyConfig.password) {
            return {
              authCredentials: {
                username: proxyConfig.username,
                password: proxyConfig.password,
              },
            };
          } else {
            return { cancel: false };
          }
        } catch (error) {
          console.error(
            `[ProxyAuth] ❌ Error handling auth for tab ${details.tabId}:`,
            error
          );
          return { cancel: false };
        }
      },
      { urls: ["<all_urls>"] },
      ["blocking"]
    );
  } else {
    console.warn("[ServiceWorker] ⚠️ webRequest.onAuthRequired not available");
  }

  // ====================================================================
  // WEBSOCKET SERVER - Port 3031
  // ====================================================================
  let wsClient: WebSocket | null = null;
  const MAX_RECONNECT_ATTEMPTS = 5;
  let reconnectAttempts = 0;

  function connectWebSocket() {
    // Clear existing connection
    if (wsClient) {
      wsClient.close();
      wsClient = null;
    }

    try {
      wsClient = new WebSocket("ws://localhost:3031");

      wsClient.onopen = () => {
        reconnectAttempts = 0;

        // Gửi initial message
        wsClient?.send(
          JSON.stringify({
            type: "browserExtensionConnected",
            timestamp: Date.now(),
          })
        );
      };

      wsClient.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error("[ServiceWorker] Failed to parse WS message:", error);
        }
      };

      wsClient.onerror = (error) => {
        console.error("[ServiceWorker] ❌ WebSocket error:", error);
      };

      wsClient.onclose = () => {
        wsClient = null;

        // Auto reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        } else {
          console.error("[ServiceWorker] ❌ Max reconnection attempts reached");
        }
      };
    } catch (error) {
      console.error("[ServiceWorker] ❌ Failed to connect WebSocket:", error);
    }
  }

  function handleWebSocketMessage(data: any) {
    // Xử lý messages từ VSCode extension
    switch (data.type) {
      case "connected":
        break;

      case "command":
        break;

      default:
        console.warn("[ServiceWorker] ⚠️ Unknown WS message type:", data.type);
    }
  }

  // Hàm gửi message tới VSCode
  function sendToVSCode(data: any) {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(JSON.stringify(data));
    } else {
      console.warn("[ServiceWorker] ⚠️ WebSocket not connected, cannot send");
    }
  }

  // Start WebSocket client connection
  connectWebSocket();

  // ====================================================================
  // GỬI TAB EVENTS TỚI VSCODE
  // ====================================================================

  // Tab created event
  browserAPI.tabs.onCreated.addListener((tab: any) => {
    sendToVSCode({
      type: "tabCreated",
      id: Date.now(),
      tab: {
        id: tab.id,
        title: tab.title,
        url: tab.url,
        cookieStoreId: tab.cookieStoreId,
        active: tab.active,
      },
    });
  });

  // Tab removed event
  browserAPI.tabs.onRemoved.addListener((tabId: number) => {
    sendToVSCode({
      type: "tabRemoved",
      id: Date.now(),
      tabId,
    });
  });

  // Tab updated event
  browserAPI.tabs.onUpdated.addListener(
    (tabId: number, changeInfo: any, tab: any) => {
      // Chỉ gửi khi có thay đổi quan trọng
      if (
        changeInfo.status === "complete" ||
        changeInfo.title ||
        changeInfo.url
      ) {
        sendToVSCode({
          type: "tabUpdated",
          id: Date.now(),
          tabId,
          changes: changeInfo,
          tab: {
            id: tab.id,
            title: tab.title,
            url: tab.url,
            cookieStoreId: tab.cookieStoreId,
          },
        });
      }
    }
  );

  // Group changed event
  browserAPI.storage.onChanged.addListener((changes: any, areaName: string) => {
    if (areaName === "local" && changes.tabGroups) {
      sendToVSCode({
        type: "groupsChanged",
        id: Date.now(),
        groups: changes.tabGroups.newValue,
      });
    }
  });
})();
