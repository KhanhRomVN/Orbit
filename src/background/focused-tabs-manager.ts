// File: src/background/focused-tabs-manager.ts
import { FocusedTabInfo } from "../types/tab-group";

export class FocusedTabsManager {
  private browserAPI: any;
  private readonly FOCUSED_TABS_KEY = "orbit-focused-tabs";

  constructor(browserAPI: any) {
    this.browserAPI = browserAPI;
  }

  async getFocusedTabs(): Promise<FocusedTabInfo[]> {
    const result = await this.browserAPI.storage.local.get([
      this.FOCUSED_TABS_KEY,
    ]);
    return result[this.FOCUSED_TABS_KEY] || [];
  }

  async setFocusedTab(containerId: string, tabId: number): Promise<void> {
    const focusedTabs = await this.getFocusedTabs();
    console.debug(`[FocusedTabsManager] 📦 Current focused tabs:`, focusedTabs);

    // Remove old focus for this container
    const filtered = focusedTabs.filter((f) => f.containerId !== containerId);

    // Add new focus
    const newFocusInfo: FocusedTabInfo = {
      containerId,
      tabId,
      timestamp: Date.now(),
    };
    filtered.push(newFocusInfo);

    console.debug(`[FocusedTabsManager] 💾 Saving focused tabs:`, filtered);
    await this.browserAPI.storage.local.set({
      [this.FOCUSED_TABS_KEY]: filtered,
    });

    // Verify save
    const verify = await this.browserAPI.storage.local.get([
      this.FOCUSED_TABS_KEY,
    ]);
    console.debug(
      `[FocusedTabsManager] ✅ Verified saved data:`,
      verify[this.FOCUSED_TABS_KEY]
    );
  }

  async removeFocusedTab(
    tabId: number,
    containerId?: string
  ): Promise<string | undefined> {
    const focusedTabs = await this.getFocusedTabs();
    const filtered = focusedTabs.filter((f) => f.tabId !== tabId);
    await this.browserAPI.storage.local.set({
      [this.FOCUSED_TABS_KEY]: filtered,
    });

    return containerId;
  }

  async getFocusedTabForContainer(containerId: string): Promise<number | null> {
    const focusedTabs = await this.getFocusedTabs();
    console.debug(`[FocusedTabsManager] 🔍 getFocusedTabForContainer:`, {
      containerId,
      allFocusedTabs: focusedTabs,
    });

    const focused = focusedTabs.find((f) => f.containerId === containerId);
    console.debug(`[FocusedTabsManager] 📌 Found focused tab:`, focused);

    const result = focused?.tabId || null;
    console.debug(`[FocusedTabsManager] 📤 Returning focusedTabId:`, result);
    return result;
  }

  async setTabFocus(
    tabId: number,
    containerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.debug(`[FocusedTabsManager] 🎯 setTabFocus called:`, {
        tabId,
        containerId,
      });

      const tab = await this.browserAPI.tabs.get(tabId);
      console.debug(`[FocusedTabsManager] 📋 Tab info:`, {
        id: tab.id,
        url: tab.url,
        cookieStoreId: tab.cookieStoreId,
      });

      if (tab.cookieStoreId !== containerId) {
        const errorMsg = `Tab container mismatch: expected ${containerId}, got ${tab.cookieStoreId}`;
        console.error(`[FocusedTabsManager] ❌ ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      await this.setFocusedTab(containerId, tabId);
      console.debug(
        `[FocusedTabsManager] ✅ Focus set in storage for tab ${tabId}`
      );

      // Broadcast focus change
      this.browserAPI.runtime
        .sendMessage({
          action: "focusChanged",
          containerId,
          focusedTabId: tabId,
        })
        .catch(() => {
          console.debug(
            "[FocusedTabsManager] No receivers for focusChanged (expected)"
          );
        });

      console.debug(
        `[FocusedTabsManager] ✅ setTabFocus completed successfully`
      );
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[FocusedTabsManager] ❌ Failed to set tab focus:`, {
        error: errorMsg,
        tabId,
        containerId,
      });
      return { success: false, error: errorMsg };
    }
  }
}
