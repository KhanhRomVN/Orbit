// File: src/background/session-manager.ts
import { TabGroup } from "../types/tab-group";

export class SessionManager {
  private browserAPI: any;
  private readonly SESSION_KEY = "orbit-session-backup";
  private readonly AUTO_SAVE_DELAY = 2000; // 2s debounce
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(browserAPI: any) {
    this.browserAPI = browserAPI;
  }

  /**
   * Lưu session backup (với debounce)
   */
  public async saveSession(
    groups: TabGroup[],
    activeGroupId: string | null
  ): Promise<void> {
    // Clear timeout cũ
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Debounce: chỉ save sau 2s không có thay đổi
    this.saveTimeout = setTimeout(async () => {
      try {
        // Convert tabs sang metadata (loại bỏ các field không cần thiết)
        const sessionGroups = groups.map((group) => ({
          ...group,
          tabs: group.tabs.map((tab) => ({
            title: tab.title || "New Tab",
            url: tab.url || "",
            favIconUrl: tab.favIconUrl || null,
            cookieStoreId: tab.cookieStoreId || "firefox-default",
            groupId: group.id,
            // Không lưu id, windowId, index => sẽ lazy-create khi click
          })),
        }));

        const sessionData = {
          timestamp: Date.now(),
          groups: sessionGroups,
          activeGroupId,
        };

        await this.browserAPI.storage.local.set({
          [this.SESSION_KEY]: sessionData,
        });

        console.log(
          `[SessionManager] ✅ Session saved: ${
            groups.length
          } groups, ${groups.reduce((sum, g) => sum + g.tabs.length, 0)} tabs`
        );
      } catch (error) {
        console.error("[SessionManager] ❌ Failed to save session:", error);
      }
    }, this.AUTO_SAVE_DELAY);
  }

  /**
   * Restore session backup khi khởi động
   */
  public async restoreSession(): Promise<{
    groups: TabGroup[];
    activeGroupId: string | null;
  } | null> {
    try {
      const result = await this.browserAPI.storage.local.get([
        this.SESSION_KEY,
      ]);
      const sessionData = result[this.SESSION_KEY];

      if (!sessionData || !sessionData.groups) {
        console.log("[SessionManager] ⚠️ No session backup found");
        return null;
      }

      // Check session age (warn nếu > 7 ngày)
      const ageInDays =
        (Date.now() - sessionData.timestamp) / (1000 * 60 * 60 * 24);
      if (ageInDays > 7) {
        console.warn(
          `[SessionManager] ⚠️ Session backup is ${Math.floor(
            ageInDays
          )} days old`
        );
      }

      console.log(
        `[SessionManager] ✅ Session restored: ${sessionData.groups.length} groups`
      );

      return {
        groups: sessionData.groups,
        activeGroupId: sessionData.activeGroupId,
      };
    } catch (error) {
      console.error("[SessionManager] ❌ Failed to restore session:", error);
      return null;
    }
  }

  /**
   * Xóa session backup (khi export/import thành công)
   */
  public async clearSession(): Promise<void> {
    try {
      await this.browserAPI.storage.local.remove([this.SESSION_KEY]);
      console.log("[SessionManager] ✅ Session backup cleared");
    } catch (error) {
      console.error("[SessionManager] ❌ Failed to clear session:", error);
    }
  }

  /**
   * Lấy thông tin session backup (để hiển thị cho user)
   */
  public async getSessionInfo(): Promise<{
    exists: boolean;
    timestamp: number | null;
    groupCount: number;
    tabCount: number;
  }> {
    try {
      const result = await this.browserAPI.storage.local.get([
        this.SESSION_KEY,
      ]);
      const sessionData = result[this.SESSION_KEY];

      if (!sessionData || !sessionData.groups) {
        return { exists: false, timestamp: null, groupCount: 0, tabCount: 0 };
      }

      const tabCount = sessionData.groups.reduce(
        (sum: number, g: TabGroup) => sum + g.tabs.length,
        0
      );

      return {
        exists: true,
        timestamp: sessionData.timestamp,
        groupCount: sessionData.groups.length,
        tabCount,
      };
    } catch (error) {
      console.error("[SessionManager] ❌ Failed to get session info:", error);
      return { exists: false, timestamp: null, groupCount: 0, tabCount: 0 };
    }
  }
}
