// File: src/background/websocket-client.ts
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private browserAPI: any;
  private reconnectTimer: number | null = null;
  private readonly WS_URL = "ws://localhost:3031";
  private readonly RECONNECT_INTERVAL = 5000; // 5 seconds
  private isIntentionallyClosed = false;

  constructor(browserAPI: any) {
    this.browserAPI = browserAPI;
  }

  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.debug("[WebSocketClient] Already connected");
      return;
    }

    try {
      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = () => {
        console.debug("[WebSocketClient] ✅ Connected to VSCode extension");
        this.isIntentionallyClosed = false;

        // Send initial connection message
        this.send({
          type: "browserExtensionConnected",
          timestamp: Date.now(),
        });

        // Send initial focused tab info
        this.sendFocusedTabInfo();

        // Clear reconnect timer if exists
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.debug("[WebSocketClient] 📩 Received:", data);
          // Handle messages from VSCode if needed
        } catch (error) {
          console.error("[WebSocketClient] Failed to parse message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[WebSocketClient] ❌ Connection error:", error);
      };

      this.ws.onclose = () => {
        console.debug("[WebSocketClient] 🔌 Connection closed");
        this.ws = null;

        // Auto-reconnect if not intentionally closed
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("[WebSocketClient] Failed to create connection:", error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    console.debug(
      `[WebSocketClient] 🔄 Scheduling reconnect in ${this.RECONNECT_INTERVAL}ms`
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.RECONNECT_INTERVAL) as unknown as number;
  }

  public disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        console.debug("[WebSocketClient] 📤 Sent:", data);
      } catch (error) {
        console.error("[WebSocketClient] Failed to send:", error);
      }
    } else {
      console.warn("[WebSocketClient] ⚠️ Cannot send, not connected");
    }
  }

  public async sendFocusedTabInfo(): Promise<void> {
    try {
      // Get all groups and focused tabs
      const result = await this.browserAPI.storage.local.get([
        "tabGroups",
        "orbit-focused-tabs",
      ]);
      const groups = result.tabGroups || [];
      const focusedTabs = result["orbit-focused-tabs"] || [];

      console.debug("[WebSocketClient] 🔍 Processing focused tabs:", {
        totalGroups: groups.length,
        totalFocusedTabs: focusedTabs.length,
      });

      // Build list of focused tabs with group info
      const focusedTabsData = [];

      for (const focusedInfo of focusedTabs) {
        try {
          // Get tab details
          const tab = await this.browserAPI.tabs.get(focusedInfo.tabId);

          // Bỏ qua tab không phải container hoặc không phải claude.ai
          if (!tab.cookieStoreId || tab.cookieStoreId === "firefox-default") {
            console.debug(
              "[WebSocketClient] ⚠️ Skipping non-container tab:",
              tab.id
            );
            continue;
          }

          if (!tab.url || !tab.url.includes("claude.ai")) {
            console.debug(
              "[WebSocketClient] ⚠️ Skipping non-claude.ai tab:",
              tab.id
            );
            continue;
          }

          // Lấy tên container từ contextualIdentities API
          let containerName = "Unknown Container";
          try {
            if (this.browserAPI.contextualIdentities) {
              const container = await this.browserAPI.contextualIdentities.get(
                tab.cookieStoreId
              );
              containerName = container?.name || tab.cookieStoreId;
            }
          } catch (error) {
            console.debug(
              "[WebSocketClient] Could not get container name:",
              error
            );
            containerName = tab.cookieStoreId;
          }

          focusedTabsData.push({
            tabId: tab.id,
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl,
            containerName: containerName,
            containerId: tab.cookieStoreId,
            timestamp: focusedInfo.timestamp,
          });

          console.debug(
            "[WebSocketClient] ✅ Added focused tab:",
            tab.title,
            "from container:",
            containerName
          );
        } catch (error) {
          console.warn(
            "[WebSocketClient] ⚠️ Failed to get tab details for tabId:",
            focusedInfo.tabId,
            error
          );
        }
      }

      // Send all focused tabs
      this.send({
        type: "focusedTabsUpdate",
        data: focusedTabsData,
      });

      console.debug(
        "[WebSocketClient] 📤 Sent",
        focusedTabsData.length,
        "focused tabs"
      );
    } catch (error) {
      console.error(
        "[WebSocketClient] Failed to send focused tab info:",
        error
      );
    }
  }
}
