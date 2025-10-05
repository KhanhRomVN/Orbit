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

      case "sendPrompt":
        this.handleSendPrompt(data);
        break;

      default:
        console.warn(
          "[WebSocketManager] ⚠️ Unknown WS message type:",
          data.type
        );
    }
  }

  private async handleSendPrompt(data: any) {
    console.log("[WebSocketManager] 📝 Handling sendPrompt:", {
      tabId: data.tabId,
      promptLength: data.prompt?.length,
    });

    try {
      // ✅ THÊM: Activate tab trước khi gửi prompt
      console.log(`[WebSocketManager] 🎯 Activating tab ${data.tabId}...`);

      // Wrap chrome.tabs.get() thành Promise cho Firefox MV2
      const tab = await new Promise<chrome.tabs.Tab>((resolve, reject) => {
        chrome.tabs.get(data.tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(tab);
        });
      });

      // Activate tab
      await new Promise<void>((resolve, reject) => {
        chrome.tabs.update(data.tabId, { active: true }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });

      // Focus window chứa tab đó
      if (tab.windowId) {
        await new Promise<void>((resolve, reject) => {
          chrome.windows.update(tab.windowId!, { focused: true }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve();
          });
        });
      }

      console.log(`[WebSocketManager] ✅ Tab ${data.tabId} activated`);

      // Đợi 300ms để tab sẵn sàng
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Gửi prompt tới tab
      chrome.tabs.sendMessage(
        data.tabId,
        {
          action: "sendPrompt",
          prompt: data.prompt,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[WebSocketManager] ❌ Runtime error:",
              chrome.runtime.lastError
            );
            this.sendToVSCode({
              type: "promptResponse",
              requestId: data.requestId,
              tabId: data.tabId,
              success: false,
              error: chrome.runtime.lastError.message,
              errorType: "runtime",
            });
            return;
          }

          if (!response) {
            console.error("[WebSocketManager] ❌ Empty response");
            this.sendToVSCode({
              type: "promptResponse",
              requestId: data.requestId,
              tabId: data.tabId,
              success: false,
              error: "Content script did not respond. Tab may need refresh.",
              errorType: "no_response",
            });
            return;
          }

          console.log("[WebSocketManager] ✅ Response received:", response);

          // Gửi response về VSCode
          this.sendToVSCode({
            type: "promptResponse",
            requestId: data.requestId,
            tabId: data.tabId,
            success: response.success,
            response: response.response,
            error: response.error,
            errorType: response.errorType,
          });
        }
      );
    } catch (error) {
      console.error("[WebSocketManager] ❌ Error handling sendPrompt:", error);
      this.sendToVSCode({
        type: "promptResponse",
        requestId: data.requestId,
        tabId: data.tabId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "unknown",
      });
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
