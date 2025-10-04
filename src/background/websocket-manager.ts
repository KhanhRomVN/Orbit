// File: src/background/websocket-manager.ts
export class WebSocketManager {
  private wsClient: WebSocket | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectAttempts = 0;
  private browserAPI: any;

  constructor() {
    this.connectWebSocket();
  }

  setBrowserAPI(browserAPI: any) {
    this.browserAPI = browserAPI;
  }

  private connectWebSocket() {
    // Clear existing connection
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }

    try {
      this.wsClient = new WebSocket("ws://localhost:3031");

      this.wsClient.onopen = () => {
        this.reconnectAttempts = 0;

        // Gửi initial message
        this.wsClient?.send(
          JSON.stringify({
            type: "browserExtensionConnected",
            timestamp: Date.now(),
          })
        );
      };

      this.wsClient.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error(
            "[WebSocketManager] Failed to parse WS message:",
            error
          );
        }
      };

      this.wsClient.onerror = (error) => {
        console.error("[WebSocketManager] ❌ WebSocket error:", error);
      };

      this.wsClient.onclose = () => {
        this.wsClient = null;

        // Auto reconnect
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          setTimeout(() => {
            this.connectWebSocket();
          }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
        } else {
          console.error(
            "[WebSocketManager] ❌ Max reconnection attempts reached"
          );
        }
      };
    } catch (error) {
      console.error(
        "[WebSocketManager] ❌ Failed to connect WebSocket:",
        error
      );
    }
  }

  private handleWebSocketMessage(data: any) {
    // Xử lý messages từ VSCode extension
    switch (data.type) {
      case "connected":
        break;

      case "command":
        break;

      default:
        console.warn(
          "[WebSocketManager] ⚠️ Unknown WS message type:",
          data.type
        );
    }
  }

  sendToVSCode(data: any) {
    if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
      this.wsClient.send(JSON.stringify(data));
    } else {
      console.warn(
        "[WebSocketManager] ⚠️ WebSocket not connected, cannot send"
      );
    }
  }

  // Tab events to send to VSCode
  sendTabCreated(tab: any) {
    this.sendToVSCode({
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
  }

  sendTabRemoved(tabId: number) {
    this.sendToVSCode({
      type: "tabRemoved",
      id: Date.now(),
      tabId,
    });
  }

  sendTabUpdated(tabId: number, changeInfo: any, tab: any) {
    // Chỉ gửi khi có thay đổi quan trọng
    if (
      changeInfo.status === "complete" ||
      changeInfo.title ||
      changeInfo.url
    ) {
      this.sendToVSCode({
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

  sendGroupsChanged(groups: any) {
    this.sendToVSCode({
      type: "groupsChanged",
      id: Date.now(),
      groups,
    });
  }
}
