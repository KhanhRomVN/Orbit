// File: src/background/session-manager.ts
import { TabGroup } from "../types/tab-group";
import { indexedDBService } from "../shared/lib/indexdb-service";

export class SessionManager {
  private browserAPI: any;
  private readonly SESSION_KEY = "orbit-session-backup";
  private isRestoringSession = false; // Flag để tránh lưu khi restore
  private isStartupMode = false; // Flag để tránh lưu khi startup

  constructor(browserAPI: any) {
    this.browserAPI = browserAPI;
    this.initBeforeUnload();
    this.initIndexedDB();
  }

  private async initIndexedDB(): Promise<void> {
    try {
      await indexedDBService.init();
      console.log("[SessionManager] ✅ IndexedDB initialized");
    } catch (error) {
      console.error("[SessionManager] ❌ Failed to init IndexedDB:", error);
    }
  }

  private initBeforeUnload(): void {
    // Save khi đóng browser (Firefox manifest v2)
    this.browserAPI.runtime.onSuspend?.addListener(() => {
      console.log("[SessionManager] 🔄 Browser closing, saving session...");
      this.saveCurrentSessionSync();
    });
  }

  private saveCurrentSessionSync(): void {
    // Synchronous save cho beforeunload (best effort)
    this.browserAPI.storage.local.get(
      ["tabGroups", "activeGroupId"],
      (result: any) => {
        const groups = result.tabGroups || [];
        const activeGroupId = result.activeGroupId || null;
        this.saveSession(groups, activeGroupId).catch(console.error);
      }
    );
  }

  /**
   * ✅ Setter cho restore flag
   */
  public setRestoringSession(isRestoring: boolean): void {
    this.isRestoringSession = isRestoring;
    console.log(`[SessionManager] 🔄 Restore mode: ${isRestoring}`);
  }

  /**
   * ✅ Setter cho startup flag
   */
  public setStartupMode(isStartup: boolean): void {
    this.isStartupMode = isStartup;
    console.log(`[SessionManager] 🚀 Startup mode: ${isStartup}`);
  }

  /**
   * Lưu session backup (LocalDB + IndexedDB)
   */
  public async saveSession(
    groups: TabGroup[],
    activeGroupId: string | null
  ): Promise<void> {
    // ✅ CRITICAL: Không lưu session khi đang restore hoặc startup
    if (this.isRestoringSession || this.isStartupMode) {
      console.log(
        `[SessionManager] ⏸️ Skipping save (restore: ${this.isRestoringSession}, startup: ${this.isStartupMode})`
      );
      return;
    }

    try {
      const timestamp = Date.now();

      const restrictedUrlPrefixes = [
        "about:",
        "chrome:",
        "chrome-extension:",
        "moz-extension:",
        "edge:",
        "opera:",
        "brave:",
        "vivaldi:",
      ];

      // Convert tabs sang metadata (SessionTab format) và filter restricted URLs
      const sessionGroups = groups.map((group) => ({
        id: group.id,
        name: group.name,
        type: group.type,
        color: group.color,
        icon: group.icon,
        visible: group.visible,
        containerId: group.containerId,
        lastActiveTabId: group.lastActiveTabId,
        createdAt: group.createdAt,
        tabs: group.tabs
          .filter((tab) => {
            // ✅ CRITICAL FIX: Loại bỏ HOÀN TOÀN các tab đặc biệt
            if (!tab.url || tab.url.trim() === "") {
              return false;
            }

            const isRestricted = restrictedUrlPrefixes.some((prefix) =>
              tab.url!.toLowerCase().startsWith(prefix.toLowerCase())
            );

            return !isRestricted;
          })
          .map((tab) => ({
            title: tab.title || "New Tab",
            url: tab.url || "",
            favIconUrl: tab.favIconUrl || null,
            cookieStoreId: tab.cookieStoreId, // ← GIỮ NGUYÊN, không default
            groupId: group.id,
          })),
      }));

      const sessionData = {
        timestamp,
        groups: sessionGroups,
        activeGroupId,
      };

      // Lưu vào LocalDB (storage.local)
      await this.browserAPI.storage.local.set({
        [this.SESSION_KEY]: sessionData,
      });

      // Lưu vào IndexedDB với signature mới
      await indexedDBService.saveSession(
        timestamp,
        sessionGroups,
        activeGroupId
      );

      // ✅ FIX: Tính tổng tabs từ sessionGroups (đã filter), không phải groups gốc
      const totalTabs = sessionGroups.reduce(
        (sum, g) => sum + g.tabs.length,
        0
      );

      console.log(
        `[SessionManager] ✅ Session saved (LocalDB + IndexedDB): ${sessionGroups.length} groups, ${totalTabs} tabs`
      );

      // ✅ Log chi tiết từng group và tab
      sessionGroups.forEach((group, groupIndex) => {
        console.log(
          `[SessionManager] 📂 Group ${groupIndex + 1}/${
            sessionGroups.length
          }: "${group.name}" (${group.tabs.length} tabs)`
        );
        group.tabs.forEach((tab, tabIndex) => {
          console.log(
            `[SessionManager]   └─ Tab ${tabIndex + 1}: "${tab.title}" → ${
              tab.url
            }`
          );
        });
      });
    } catch (error) {
      console.error("[SessionManager] ❌ Failed to save session:", error);
    }
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

      // ✅ CRITICAL: Verify session data integrity
      const totalTabs = sessionData.groups.reduce(
        (sum: number, g: any) => sum + g.tabs.length,
        0
      );

      console.log("[SessionManager] 📦 Session data loaded:", {
        groups: sessionData.groups.length,
        totalTabs,
        groupDetails: sessionData.groups.map((g: any) => ({
          id: g.id,
          name: g.name,
          tabCount: g.tabs.length,
        })),
      });

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
        `[SessionManager] ✅ Session restored: ${sessionData.groups.length} groups, ${totalTabs} tabs`
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
   * Xóa session backup (LocalDB + IndexedDB)
   */
  public async clearSession(): Promise<void> {
    try {
      await this.browserAPI.storage.local.remove([this.SESSION_KEY]);
      await indexedDBService.clearSession();
      console.log("[SessionManager] ✅ Session cleared (LocalDB + IndexedDB)");
    } catch (error) {
      console.error("[SessionManager] ❌ Failed to clear session:", error);
    }
  }

  /**
   * Lấy thông tin session backup (ưu tiên IndexedDB)
   */
  public async getSessionInfo(): Promise<{
    exists: boolean;
    timestamp: number | null;
    groupCount: number;
    tabCount: number;
    source: "indexedDB" | "localStorage" | null;
  }> {
    try {
      // Ưu tiên IndexedDB
      let sessionData = await indexedDBService.getSession();
      let source: "indexedDB" | "localStorage" | null = null;

      if (sessionData) {
        source = "indexedDB";
      } else {
        // Fallback sang localStorage
        const result = await this.browserAPI.storage.local.get([
          this.SESSION_KEY,
        ]);
        sessionData = result[this.SESSION_KEY];
        if (sessionData) {
          source = "localStorage";
        }
      }

      if (!sessionData || !sessionData.groups) {
        return {
          exists: false,
          timestamp: null,
          groupCount: 0,
          tabCount: 0,
          source: null,
        };
      }

      const tabCount = sessionData.groups.reduce(
        (sum: number, g) => sum + g.tabs.length,
        0
      );

      return {
        exists: true,
        timestamp: sessionData.timestamp,
        groupCount: sessionData.groups.length,
        tabCount,
        source,
      };
    } catch (error) {
      console.error("[SessionManager] ❌ Failed to get session info:", error);
      return {
        exists: false,
        timestamp: null,
        groupCount: 0,
        tabCount: 0,
        source: null,
      };
    }
  }
}
