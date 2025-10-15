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

    // Remove old focus for this container
    const filtered = focusedTabs.filter((f) => f.containerId !== containerId);

    // Add new focus
    const newFocusInfo: FocusedTabInfo = {
      containerId,
      tabId,
      timestamp: Date.now(),
    };
    filtered.push(newFocusInfo);

    await this.browserAPI.storage.local.set({
      [this.FOCUSED_TABS_KEY]: filtered,
    });

    // Verify save
    await this.browserAPI.storage.local.get([this.FOCUSED_TABS_KEY]);
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
    const focused = focusedTabs.find((f) => f.containerId === containerId);
    const result = focused?.tabId || null;
    return result;
  }

  async setTabFocus(
    tabId: number,
    containerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tab = await this.browserAPI.tabs.get(tabId);
      if (tab.cookieStoreId !== containerId) {
        const errorMsg = `Tab container mismatch: expected ${containerId}, got ${tab.cookieStoreId}`;
        console.error(`[FocusedTabsManager] ❌ ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      await this.setFocusedTab(containerId, tabId);

      // Broadcast focus change
      this.browserAPI.runtime.sendMessage({
        action: "focusChanged",
        containerId,
        focusedTabId: tabId,
      });

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
