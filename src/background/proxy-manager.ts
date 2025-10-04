// File: src/background/proxy-manager.ts
export class ProxyManager {
  private browserAPI: any;

  constructor(browserAPI: any) {
    this.browserAPI = browserAPI;
    this.setupProxyHandlers();
  }

  async applyGroupProxy(
    groupId: string,
    proxyId: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get tab manager from global
      const tabManager = (globalThis as any).tabManager;
      if (!tabManager) {
        throw new Error("Tab manager not available");
      }

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
        const result = await this.browserAPI.storage.local.get([
          "orbit-proxies",
        ]);
        const proxies = result["orbit-proxies"] || [];
        const proxyConfig = proxies.find((p: any) => p.id === proxyId);

        if (!proxyConfig) {
          throw new Error("Proxy not found");
        }

        // Lấy danh sách container hiện tại của proxy này
        const assignmentsResult = await this.browserAPI.storage.local.get([
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

        await this.browserAPI.storage.local.set({
          "orbit-proxy-assignments": assignments,
        });
      } else {
        // Remove container từ tất cả proxy assignments
        const assignmentsResult = await this.browserAPI.storage.local.get([
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
              await this.browserAPI.storage.local.set({
                "orbit-proxy-assignments": filtered,
              });
              return { success: true };
            }
          }
        }

        await this.browserAPI.storage.local.set({
          "orbit-proxy-assignments": assignments,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("[ProxyManager] ❌ Failed to apply group proxy:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async applyTabProxy(
    tabId: number,
    proxyId: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let proxyConfig = null;
      if (proxyId) {
        const result = await this.browserAPI.storage.local.get([
          "orbit-proxies",
        ]);
        const proxies = result["orbit-proxies"] || [];
        proxyConfig = proxies.find((p: any) => p.id === proxyId);

        if (!proxyConfig) {
          throw new Error("Proxy not found");
        }
      }

      await this.applyProxyToTab(tabId, proxyConfig);
      return { success: true };
    } catch (error) {
      console.error("[ProxyManager] ❌ Failed to apply tab proxy:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async applyProxyToTab(tabId: number, proxyConfig: any) {
    // Firefox implementation using webRequest
    if (this.browserAPI.webRequest) {
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
          await this.browserAPI.storage.session.set({
            [`proxy_${tabId}`]: proxyInfo,
          });
        } catch (error) {
          // Fallback to local storage if session storage not available
          await this.browserAPI.storage.local.set({
            [`proxy_${tabId}`]: proxyInfo,
          });
        }
      } else {
        // Remove proxy configuration
        try {
          await this.browserAPI.storage.session.remove([`proxy_${tabId}`]);
        } catch (error) {
          await this.browserAPI.storage.local.remove([`proxy_${tabId}`]);
        }
      }
    } else if (this.browserAPI.proxy) {
      // Chrome implementation
      console.warn(
        "[ProxyManager] ⚠️ Chrome per-tab proxy requires PAC script implementation"
      );

      // Store proxy assignment for potential PAC script usage
      if (proxyConfig) {
        await this.browserAPI.storage.local.set({
          [`proxy_${tabId}`]: {
            type: proxyConfig.type,
            host: proxyConfig.address,
            port: proxyConfig.port,
            username: proxyConfig.username,
            password: proxyConfig.password,
          },
        });
      } else {
        await this.browserAPI.storage.local.remove([`proxy_${tabId}`]);
      }
    }
  }

  private setupProxyHandlers() {
    // FIREFOX PROXY HANDLER - Apply per-tab proxy via proxy.onRequest
    if (this.browserAPI.proxy && this.browserAPI.proxy.onRequest) {
      this.browserAPI.proxy.onRequest.addListener(
        (requestInfo: any) => {
          const tabId = requestInfo.tabId;
          // Skip system requests
          if (tabId === -1 || tabId === undefined) {
            return { type: "direct" };
          }

          return new Promise(async (resolve) => {
            try {
              // Lấy thông tin tab
              const tab = await this.browserAPI.tabs.get(tabId);
              if (!tab) {
                resolve({ type: "direct" });
                return;
              }

              // Lấy proxy assignments và proxies
              const result = await this.browserAPI.storage.local.get([
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
                  `[ProxyManager] ⚠️ Proxy config not found for ID: ${proxyAssignment.proxyId}`
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
                `[ProxyManager] ❌ Error in proxy handler for tab ${tabId}:`,
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
        "[ProxyManager] ⚠️ browser.proxy.onRequest not available - per-tab proxy will not work"
      );
    }

    // PROXY AUTHENTICATION HANDLER
    if (
      this.browserAPI.webRequest &&
      this.browserAPI.webRequest.onAuthRequired
    ) {
      this.browserAPI.webRequest.onAuthRequired.addListener(
        async (details: any) => {
          // Get tab info
          try {
            const tab = await this.browserAPI.tabs.get(details.tabId);
            if (!tab) {
              return { cancel: false };
            }

            // Get proxy assignments
            const result = await this.browserAPI.storage.local.get([
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
      console.warn("[ProxyManager] ⚠️ webRequest.onAuthRequired not available");
    }
  }

  async cleanupTabProxy(tabId: number): Promise<void> {
    try {
      // Clean up proxy assignment when tab is closed
      await this.browserAPI.storage.local.remove([`proxy_${tabId}`]);
      try {
        await this.browserAPI.storage.session.remove([`proxy_${tabId}`]);
      } catch (error) {
        // Session storage might not be available
      }
    } catch (error) {
      console.error(
        "[ProxyManager] Failed to clean up proxy for closed tab:",
        error
      );
    }
  }
}
