// File: src/background/message-handler.ts
import { TabManager } from "./tab-manager";
import { FocusedTabsManager } from "./focused-tabs-manager";
import { ProxyManager } from "./proxy-manager";

export class MessageHandler {
  constructor(
    private tabManager: TabManager,
    private focusedTabsManager: FocusedTabsManager,
    private proxyManager: ProxyManager
  ) {}

  async handleMessage(
    message: any,
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      let result: any;

      switch (message.action) {
        case "sendPromptToTab":
          // ✅ FIX: Không dùng await, pass sendResponse trực tiếp
          this.sendPromptToTab(message.tabId, message.prompt, sendResponse);
          return; // Dừng execution, đừng call sendResponse ở cuối

        case "setActiveGroup":
          await this.tabManager.setActiveGroup(message.groupId);
          result = { success: true };
          break;

        case "createGroup": {
          try {
            const newGroup = await this.tabManager.createGroup(
              message.groupData
            );

            if (!newGroup || !newGroup.id) {
              console.error(
                "[MessageHandler] ❌ Invalid group response:",
                newGroup
              );
              throw new Error("Failed to create group - invalid response");
            }
            result = newGroup;
          } catch (error) {
            console.error("[MessageHandler] ❌ createGroup error:", error);
            throw error;
          }
          break;
        }

        case "createTabInGroup":
          result = await this.tabManager.createTabInGroup(
            message.groupId,
            message.url
          );
          break;

        case "getContainers":
          result = await this.tabManager.getContainers();
          break;

        case "applyGroupProxy":
          result = await this.proxyManager.applyGroupProxy(
            message.groupId,
            message.proxyId
          );
          break;

        case "applyTabProxy":
          result = await this.proxyManager.applyTabProxy(
            message.tabId,
            message.proxyId
          );
          break;

        case "setTabFocus":
          result = await this.focusedTabsManager.setTabFocus(
            message.tabId,
            message.containerId
          );
          console.debug(
            "[MessageHandler] ✅ setTabFocus completed, result:",
            result
          );
          break;

        case "removeTabFocus":
          await this.focusedTabsManager.removeFocusedTab(message.tabId);

          // ✅ THÊM: Broadcast focus removed
          if (message.containerId) {
            chrome.runtime
              .sendMessage({
                action: "focusChanged",
                containerId: message.containerId,
                focusedTabId: null,
              })
              .catch(() => {
                console.debug(
                  "[MessageHandler] No receivers for focusChanged (expected)"
                );
              });
          }

          result = { success: true };
          break;

        case "getFocusedTab":
          const focusedTabId =
            await this.focusedTabsManager.getFocusedTabForContainer(
              message.containerId
            );
          result = { focusedTabId };
          console.debug(`[MessageHandler] 📨 getFocusedTab returning:`, result);
          break;

        default:
          console.warn(
            `[MessageHandler] ⚠️ Unknown message action: ${message.action}`
          );
          result = { error: `Unknown action: ${message.action}` };
      }

      console.debug(
        `[MessageHandler] 📤 Final result being sent via sendResponse:`,
        result
      );
      sendResponse(result);
    } catch (error) {
      console.error("[MessageHandler] Message handler error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      sendResponse({ error: errorMessage });
    }
  }

  private sendPromptToTab(
    tabId: number,
    prompt: string,
    sendResponse: (response: any) => void
  ): void {
    console.debug(`[MessageHandler] 📤 Sending prompt to tab ${tabId}`);

    // ✅ THÊM: Ping test trước khi gửi prompt
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (pingResponse) => {
      if (chrome.runtime.lastError || !pingResponse) {
        console.error(
          `[MessageHandler] ❌ Content script not ready:`,
          chrome.runtime.lastError?.message || "No response"
        );
        sendResponse({
          success: false,
          error: "Content script not loaded. Please refresh the Claude.ai tab.",
          errorType: "content_script_not_ready",
        });
        return;
      }

      console.debug(
        `[MessageHandler] ✅ Content script ready, sending prompt...`
      );

      // Gửi prompt thật
      chrome.tabs.sendMessage(
        tabId,
        {
          action: "sendPrompt",
          prompt: prompt,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              `[MessageHandler] ❌ Runtime error sending to tab ${tabId}:`,
              chrome.runtime.lastError
            );
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
              errorType: "runtime",
            });
            return;
          }

          if (!response) {
            console.error(
              `[MessageHandler] ❌ Empty response from tab ${tabId}`
            );
            sendResponse({
              success: false,
              error: "Content script did not respond",
              errorType: "no_response",
            });
            return;
          }

          console.debug(`[MessageHandler] 📥 Received response:`, response);
          sendResponse(response);
        }
      );
    });
  }
}
