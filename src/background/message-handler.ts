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

        case "deleteGroup":
          await this.tabManager.deleteGroup(message.groupId);
          result = { success: true };
          break;

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
          break;

        case "removeTabFocus":
          await this.focusedTabsManager.removeFocusedTab(message.tabId);

          if (message.containerId) {
            chrome.runtime.sendMessage({
              action: "focusChanged",
              containerId: message.containerId,
              focusedTabId: null,
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
          break;

        case "assignTabToGroup":
          await this.tabManager.assignTabToGroup(
            message.tabId,
            message.groupId,
            message.position // THÊM POSITION
          );
          result = { success: true };
          break;

        case "removeMetadataTabAtPosition":
          await this.tabManager.removeMetadataTabAtPosition(
            message.groupId,
            message.tabUrl,
            message.tabTitle,
            message.position
          );
          result = { success: true };
          break;

        case "updateMetadataTab":
          await this.tabManager.updateMetadataTab(
            message.groupId,
            message.oldTabUrl,
            message.oldTabTitle,
            message.newTab
          );
          result = { success: true };
          break;

        case "removeMetadataTab":
          await this.tabManager.removeMetadataTab(
            message.groupId,
            message.tabUrl,
            message.tabTitle
          );
          result = { success: true };
          break;

        case "reloadAfterImport":
          // Reload groups từ storage
          await this.tabManager.reloadFromStorage();
          result = { success: true };
          break;
        case "createTabInGroupAtPosition":
          result = await this.tabManager.createTabInGroupAtPosition(
            message.groupId,
            message.url,
            message.position
          );
          break;

        // ✅ THÊM: Refresh hiển thị group
        case "refreshActiveGroupDisplay":
          if (message.groupId) {
            await this.tabManager.setActiveGroup(message.groupId);
          }
          result = { success: true };
          break;

        case "getSessionInfo":
          try {
            const sessionMgr = (globalThis as any).sessionManager;
            if (sessionMgr) {
              const sessionInfoResult = await sessionMgr.getSessionInfo();
              console.debug(
                "[MessageHandler] 📤 Returning session info:",
                sessionInfoResult
              );
              result = sessionInfoResult;
            } else {
              console.warn("[MessageHandler] ⚠️ SessionManager not available");
              result = {
                exists: false,
                timestamp: null,
                groupCount: 0,
                tabCount: 0,
                source: null,
              };
            }
          } catch (error) {
            console.error(
              "[MessageHandler] ❌ Error getting session info:",
              error
            );
            result = {
              exists: false,
              timestamp: null,
              groupCount: 0,
              tabCount: 0,
              source: null,
            };
          }
          break;

        case "restoreSession":
          const sessionMgr = (globalThis as any).sessionManager;
          if (sessionMgr) {
            // ✅ CRITICAL: Set flag để không lưu session trong quá trình restore
            sessionMgr.setRestoringSession(true);

            const session = await sessionMgr.restoreSession();
            if (session) {
              const totalTabs = session.groups.reduce(
                (sum: number, g: any) => sum + g.tabs.length,
                0
              );

              console.log("[MessageHandler] 📦 Restoring session:", {
                groups: session.groups.length,
                totalTabs,
                groupDetails: session.groups.map((g: any) => ({
                  id: g.id,
                  name: g.name,
                  tabCount: g.tabs.length,
                })),
              });

              // ✅ CRITICAL: Verify session data TRƯỚC KHI lưu
              if (totalTabs === 0) {
                console.error(
                  "[MessageHandler] ❌ Session has 0 tabs, aborting restore"
                );
                result = { success: false, error: "Session data is empty" };
                // ✅ Reset flag trước khi break
                sessionMgr.setRestoringSession(false);
                break;
              }

              // ✅ TRỰC TIẾP GHI ĐÈ STORAGE (không merge)
              const browserAPI = this.tabManager["browserAPI"];

              await browserAPI.storage.local.set({
                tabGroups: session.groups,
                activeGroupId: session.activeGroupId,
              });

              // ✅ Verify data đã lưu thành công
              const verifyResult = await browserAPI.storage.local.get([
                "tabGroups",
              ]);
              const savedTabCount =
                verifyResult.tabGroups?.reduce(
                  (sum: number, g: any) => sum + g.tabs.length,
                  0
                ) || 0;

              console.log("[MessageHandler] ✅ Verification:", {
                savedGroups: verifyResult.tabGroups?.length || 0,
                savedTabs: savedTabCount,
              });

              if (savedTabCount === 0) {
                console.error("[MessageHandler] ❌ Data lost after save!");
                result = { success: false, error: "Data lost during restore" };
                // ✅ Reset flag trước khi break
                sessionMgr.setRestoringSession(false);
                break;
              }

              console.log("[MessageHandler] ✅ Session written to storage");

              // ✅ RELOAD TAB MANAGER
              await this.tabManager.reloadFromStorage();

              console.log("[MessageHandler] ✅ TabManager reloaded");

              // ✅ CLEAR SESSION SAU KHI ĐẢM BẢO RESTORE THÀNH CÔNG
              await sessionMgr.clearSession();

              console.log("[MessageHandler] ✅ Session cleared");

              // ✅ CRITICAL: Reset flag sau khi restore xong
              sessionMgr.setRestoringSession(false);

              result = { success: true };
            } else {
              console.error("[MessageHandler] ❌ No session data found");
              // ✅ Reset flag nếu không có session
              sessionMgr.setRestoringSession(false);
              result = { success: false, error: "No session found" };
            }
          } else {
            console.error("[MessageHandler] ❌ SessionManager not available");
            result = { success: false, error: "Session manager not available" };
          }
          break;

        case "clearSession":
          const sessionMgrClear = (globalThis as any).sessionManager;
          if (sessionMgrClear) {
            await sessionMgrClear.clearSession();
            result = { success: true };
            console.debug("[MessageHandler] ✅ Session cleared successfully");
          } else {
            result = { success: false, error: "Session manager not available" };
            console.error("[MessageHandler] ❌ Session manager not available");
          }
          break;

        default:
          console.warn(
            `[MessageHandler] ⚠️ Unknown message action: ${message.action}`
          );
          result = { error: `Unknown action: ${message.action}` };
      }

      sendResponse(result);
    } catch (error) {
      console.error("[MessageHandler] Message handler error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      sendResponse({ error: errorMessage });
    }
  }
}
