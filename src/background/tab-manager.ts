// File: src/background/tab-manager.ts
import { TabGroup, ExtendedTab, BrowserContainer } from "../types/tab-group";

export class TabManager {
  private browserAPI: any;
  private groups: TabGroup[] = [];
  private activeGroupId: string | null = null;

  constructor(browserAPI: any) {
    this.browserAPI = browserAPI;
    this.initialize();
  }

  private async initialize() {
    await this.loadGroups();
    await this.loadActiveGroup();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Tab created
    this.browserAPI.tabs.onCreated.addListener((tab: ExtendedTab) => {
      this.handleTabCreated(tab);
    });

    // Tab removed
    this.browserAPI.tabs.onRemoved.addListener((tabId: number) => {
      this.handleTabRemoved(tabId);
    });

    // Tab updated
    this.browserAPI.tabs.onUpdated.addListener(
      (tabId: number, changeInfo: any, tab: ExtendedTab) => {
        this.handleTabUpdated(tabId, changeInfo, tab);
      }
    );

    // Tab activated
    this.browserAPI.tabs.onActivated.addListener((activeInfo: any) => {
      this.handleTabActivated(activeInfo);
    });
  }

  private async handleTabCreated(tab: ExtendedTab) {
    // Skip nếu được flag từ showActiveGroupTabs
    if ((this as any)._skipNextTabCreated) {
      return;
    }

    // Bỏ qua nếu tab này đã được assign rồi (tránh duplicate)
    const alreadyAssigned = this.groups.some((g) =>
      g.tabs.some((t) => t.id === tab.id)
    );

    if (alreadyAssigned) {
      return;
    }

    if (this.activeGroupId && tab.id) {
      const group = this.groups.find((g) => g.id === this.activeGroupId);
      if (group) {
        if (group.type === "container") {
          const hasCorrectContainer = tab.cookieStoreId === group.containerId;

          if (!hasCorrectContainer) {
            try {
              const tabUrl =
                tab.url && !tab.url.startsWith("about:") ? tab.url : undefined;

              await this.browserAPI.tabs.remove(tab.id);

              await this.createTabInGroup(group.id, tabUrl);

              return;
            } catch (error) {
              console.error(
                "[TabManager] ❌ Failed to recreate tab with container:",
                error
              );
              return;
            }
          }

          await this.assignTabToGroup(tab.id, this.activeGroupId);

          // Show và activate tab
          if (this.browserAPI.tabs.show) {
            try {
              await this.browserAPI.tabs.show([tab.id]);
              await this.browserAPI.tabs.update(tab.id, { active: true });
              if (tab.windowId) {
                await this.browserAPI.windows.update(tab.windowId, {
                  focused: true,
                });
              }
            } catch (error) {
              console.error(
                "[TabManager] Failed to show/activate new tab:",
                error
              );
            }
          }
        } else {
          await this.assignTabToGroup(tab.id, this.activeGroupId);

          // Show và activate tab
          if (this.browserAPI.tabs.show) {
            try {
              await this.browserAPI.tabs.show([tab.id]);
              await this.browserAPI.tabs.update(tab.id, { active: true });
              if (tab.windowId) {
                await this.browserAPI.windows.update(tab.windowId, {
                  focused: true,
                });
              }
            } catch (error) {
              console.error(
                "[TabManager] Failed to show/activate new tab:",
                error
              );
            }
          }
        }
      }
    }
  }

  private async broadcastGroupsUpdate(): Promise<void> {
    try {
      // QUAN TRỌNG: KHÔNG reload từ storage vì sẽ gây race condition
      // Data đã có trong this.groups và this.activeGroupId

      this.browserAPI.runtime
        .sendMessage({
          action: "groupsUpdated",
          groups: this.groups,
          activeGroupId: this.activeGroupId,
        })
        .catch(() => {
          // No receivers, that's fine
        });
    } catch (error) {
      console.error("[TabManager] Broadcast error:", error);
    }
  }

  private async handleTabRemoved(tabId: number) {
    // Remove tab from all groups
    for (const group of this.groups) {
      const tabIndex = group.tabs.findIndex((t) => t.id === tabId);
      if (tabIndex > -1) {
        group.tabs.splice(tabIndex, 1);
        await this.saveGroups();
        break;
      }
    }
  }

  private async handleTabUpdated(
    tabId: number,
    _changeInfo: any,
    tab: ExtendedTab
  ) {
    // Update tab info in groups
    for (const group of this.groups) {
      const existingTab = group.tabs.find((t) => t.id === tabId);
      if (existingTab) {
        Object.assign(existingTab, { ...tab, groupId: group.id });
        await this.saveGroups();
        break;
      }
    }
  }

  private async handleTabActivated(activeInfo: any) {
    // Update active state in groups
    for (const group of this.groups) {
      for (const tab of group.tabs) {
        // Set all tabs to inactive first
        tab.active = false;

        // Mark the activated tab as active
        if (tab.id === activeInfo.tabId) {
          tab.active = true;
          // Save this as the last active tab for this group
          group.lastActiveTabId = activeInfo.tabId;
        }
      }
    }

    await this.saveGroups();
  }

  public async initializeDefaultGroups() {
    const allTabs = await this.browserAPI.tabs.query({});
    const tempGroup: TabGroup = {
      id: "temp-group",
      name: "Temp",
      type: "custom",
      color: "#6B7280",
      icon: "📦",
      tabs: allTabs.map((tab: ExtendedTab) => ({
        ...tab,
        groupId: "temp-group",
      })),
      visible: true,
      createdAt: Date.now(),
    };

    this.groups = [tempGroup];
    this.activeGroupId = tempGroup.id;

    // ✅ FIX: Phải save CẢ groups VÀ activeGroupId
    await this.saveGroups();
    await this.saveActiveGroup(); // ← THÊM DÒNG NÀY

    await this.showActiveGroupTabs();
  }

  public async createGroup(
    groupData: Omit<TabGroup, "id" | "tabs" | "createdAt">
  ): Promise<TabGroup> {
    await this.loadGroups();

    const newGroup: TabGroup = {
      ...groupData,
      id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tabs: [],
      createdAt: Date.now(),
    };

    this.groups.push(newGroup);
    await this.saveGroups();

    return newGroup;
  }

  public async updateGroup(
    groupId: string,
    groupData: Partial<Omit<TabGroup, "id" | "tabs" | "createdAt">>
  ): Promise<TabGroup> {
    const groupIndex = this.groups.findIndex((g) => g.id === groupId);

    if (groupIndex === -1) {
      throw new Error(`Group not found: ${groupId}`);
    }

    // Update group data
    this.groups[groupIndex] = {
      ...this.groups[groupIndex],
      ...groupData,
    };

    await this.saveGroups();
    return this.groups[groupIndex];
  }

  public async deleteGroup(groupId: string): Promise<void> {
    const groupIndex = this.groups.findIndex((g) => g.id === groupId);

    if (groupIndex === -1) {
      console.warn("[TabManager] ⚠️ Group not found:", groupId);
      return;
    }

    const groupToDelete = this.groups[groupIndex];

    // ✅ FIX: Đóng tất cả các tab thực tế trong group trước khi xóa
    console.log(
      `[TabManager] 🗑️ Closing ${groupToDelete.tabs.length} tabs from group "${groupToDelete.name}"`
    );

    const tabIdsToClose = groupToDelete.tabs
      .map((tab) => tab.id)
      .filter((id): id is number => id !== undefined && id !== null);

    if (tabIdsToClose.length > 0) {
      try {
        await this.browserAPI.tabs.remove(tabIdsToClose);
      } catch (error) {
        console.error("[TabManager] ❌ Failed to close some tabs:", error);
      }
    }

    // If this is the active group, switch to another group
    if (this.activeGroupId === groupId) {
      const otherGroup = this.groups.find((g) => g.id !== groupId);
      this.activeGroupId = otherGroup ? otherGroup.id : null;

      if (this.activeGroupId) {
        await this.showActiveGroupTabs();
      }
    }

    this.groups.splice(groupIndex, 1);

    await this.saveGroups();
  }

  public async assignTabToGroup(tabId: number, groupId: string): Promise<void> {
    // Remove tab from any existing group
    for (const group of this.groups) {
      const tabIndex = group.tabs.findIndex((t) => t.id === tabId);
      if (tabIndex > -1) {
        group.tabs.splice(tabIndex, 1);
      }
    }

    // Add to new group
    const targetGroup = this.groups.find((g) => g.id === groupId);
    if (targetGroup) {
      const tab = await this.browserAPI.tabs.get(tabId);
      // Đảm bảo groupId được gán cho tab
      targetGroup.tabs.push({
        ...tab,
        groupId,
      });
      await this.saveGroups();
    }
  }

  public async updateMetadataTab(
    groupId: string,
    oldTabUrl: string,
    oldTabTitle: string,
    newTab: ExtendedTab
  ): Promise<void> {
    console.group(`[TabManager] 🔄 updateMetadataTab called`);
    console.log(`📊 Parameters:`, {
      groupId,
      oldUrl: oldTabUrl,
      oldTitle: oldTabTitle,
      newTabId: newTab.id,
      newUrl: newTab.url,
    });

    const group = this.groups.find((g) => g.id === groupId);
    if (!group) {
      console.error(`[TabManager] ❌ Group not found: ${groupId}`);
      console.groupEnd();
      return;
    }

    console.log(
      `[TabManager] ✅ Group found: "${group.name}" (${group.tabs.length} tabs)`
    );

    // Tìm metadata tab cần thay thế
    const tabIndex = group.tabs.findIndex(
      (t) => !t.id && t.url === oldTabUrl && t.title === oldTabTitle
    );

    console.log(`[TabManager] 🔍 Searching for metadata tab:`, {
      searchUrl: oldTabUrl,
      searchTitle: oldTabTitle,
      foundIndex: tabIndex,
      allTabs: group.tabs.map((t, idx) => ({
        index: idx,
        id: t.id || "(no id)",
        title: t.title,
        url: t.url,
      })),
    });

    if (tabIndex === -1) {
      console.warn(
        `[TabManager] ⚠️ Metadata tab not found in group "${group.name}"`
      );
      console.log(
        `[TabManager] 🔍 Debug: Group tabs:`,
        group.tabs.map((t) => ({
          hasId: !!t.id,
          url: t.url,
          title: t.title,
        }))
      );
      console.groupEnd();
      return;
    }

    console.log(`[TabManager] ✅ Found metadata tab at index ${tabIndex}`);
    console.log(`[TabManager] 📝 Old tab:`, group.tabs[tabIndex]);

    // Thay thế metadata tab bằng real tab
    group.tabs[tabIndex] = {
      ...newTab,
      groupId,
    };

    console.log(`[TabManager] 📝 New tab:`, group.tabs[tabIndex]);

    await this.saveGroups();

    console.log(
      `[TabManager] ✅ Metadata tab updated in group "${group.name}"`
    );
    console.log(`[TabManager] 📊 Group now has ${group.tabs.length} tabs`);
    console.groupEnd();
  }

  public async setActiveGroup(groupId: string): Promise<void> {
    console.log(`[TabManager] 🎯 setActiveGroup called:`, {
      newGroupId: groupId,
      currentActiveGroupId: this.activeGroupId,
      totalGroups: this.groups.length,
      groups: this.groups.map((g) => ({
        id: g.id,
        name: g.name,
        tabCount: g.tabs.length,
      })),
    });

    // ✅ CRITICAL FIX: Kiểm tra group có tồn tại không, nếu không thì reload
    let targetGroup = this.groups.find((g) => g.id === groupId);

    if (!targetGroup) {
      console.warn(
        `[TabManager] ⚠️ Group ${groupId} not found in memory, reloading from storage...`
      );
      await this.loadGroups();
      targetGroup = this.groups.find((g) => g.id === groupId);

      if (!targetGroup) {
        console.error(
          `[TabManager] ❌ Group ${groupId} not found even after reload!`
        );
        throw new Error(`Group not found: ${groupId}`);
      }

      console.log(`[TabManager] ✅ Group found after reload:`, {
        id: targetGroup.id,
        name: targetGroup.name,
        tabCount: targetGroup.tabs.length,
      });
    }

    // Save current group's last active tab before switching
    if (this.activeGroupId) {
      const currentGroup = this.groups.find((g) => g.id === this.activeGroupId);
      if (currentGroup) {
        const currentActiveTab = currentGroup.tabs.find((t) => t.active);
        if (currentActiveTab?.id) {
          currentGroup.lastActiveTabId = currentActiveTab.id;
          await this.saveGroups();
        }
      }
    }

    this.activeGroupId = groupId;
    await this.saveActiveGroup();
    await this.showActiveGroupTabs();
  }

  private async showActiveGroupTabs(): Promise<void> {
    console.log(`[TabManager] 👁️ showActiveGroupTabs called:`, {
      activeGroupId: this.activeGroupId,
      totalGroups: this.groups.length,
      groups: this.groups.map((g) => ({
        id: g.id,
        name: g.name,
        tabCount: g.tabs.length,
      })),
    });

    if (!this.activeGroupId) {
      console.warn("[TabManager] ⚠️ No active group ID, returning");
      return;
    }

    // ✅ FIX: Reload CẢ groups VÀ activeGroupId nếu cần
    if (this.groups.length === 0) {
      console.error(
        "[TabManager] ⚠️ CRITICAL: this.groups is empty, reloading from storage..."
      );
      await this.loadGroups();
      await this.loadActiveGroup();

      console.log(`[TabManager] ✅ After reload:`, {
        activeGroupId: this.activeGroupId,
        totalGroups: this.groups.length,
        groups: this.groups.map((g) => ({
          id: g.id,
          name: g.name,
          tabCount: g.tabs.length,
        })),
      });
    }

    const allTabs = await this.browserAPI.tabs.query({});

    let activeGroup = this.groups.find((g) => g.id === this.activeGroupId);

    console.log(`[TabManager] 🔍 Active group found (first attempt):`, {
      found: !!activeGroup,
      groupId: activeGroup?.id,
      groupName: activeGroup?.name,
      tabCount: activeGroup?.tabs.length || 0,
    });

    // ✅ CRITICAL FIX: Nếu không tìm thấy, reload và thử lại
    if (!activeGroup) {
      console.warn(
        `[TabManager] ⚠️ Active group not found in memory, reloading...`
      );
      await this.loadGroups();
      activeGroup = this.groups.find((g) => g.id === this.activeGroupId);

      console.log(`[TabManager] 🔍 Active group found (after reload):`, {
        found: !!activeGroup,
        groupId: activeGroup?.id,
        groupName: activeGroup?.name,
        tabCount: activeGroup?.tabs.length || 0,
      });

      if (!activeGroup) {
        console.error(
          "[TabManager] ❌ Active group not found even after reload:",
          this.activeGroupId
        );
        return;
      }
    }

    const isPrivilegedUrl = (_url: string | undefined): boolean => {
      return false;
    };

    if (activeGroup.tabs.length === 0) {
      console.warn(
        `[TabManager] ⚠️ Group "${activeGroup.name}" has 0 tabs, creating new tab...`
      );

      try {
        const skipNextTabCreated = true;
        (this as any)._skipNextTabCreated = skipNextTabCreated;

        const newTab = await this.createTabInGroup(this.activeGroupId);

        delete (this as any)._skipNextTabCreated;

        console.log(`[TabManager] ✅ Created new tab in empty group:`, {
          tabId: newTab.id,
          groupId: activeGroup.id,
          groupName: activeGroup.name,
        });

        if (newTab.id) {
          await this.browserAPI.tabs.update(newTab.id, { active: true });
          if (newTab.windowId) {
            await this.browserAPI.windows.update(newTab.windowId, {
              focused: true,
            });
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const tabsToHide = allTabs
          .filter((tab: ExtendedTab) => {
            const shouldHide =
              tab.id && tab.id !== newTab.id && !isPrivilegedUrl(tab.url);
            return shouldHide;
          })
          .map((tab: ExtendedTab) => tab.id) as number[];

        if (tabsToHide.length > 0 && this.browserAPI.tabs.hide) {
          try {
            await this.browserAPI.tabs.hide(tabsToHide);
            console.log(`[TabManager] 👁️ Hid ${tabsToHide.length} tabs`);
          } catch (error) {
            console.warn("[TabManager] Failed to hide some tabs:", error);
          }
        }

        return;
      } catch (error) {
        console.error(
          `[TabManager] ❌ CRITICAL: Failed to create tab in empty group:`,
          {
            error: error,
            groupId: activeGroup.id,
            groupName: activeGroup.name,
          }
        );

        // ✅ FIX: Không return để vẫn tiếp tục xử lý (tránh group bị stuck)
        // Thay vào đó, reload groups và thử lại
        await this.loadGroups();
        await this.loadActiveGroup();

        // Nếu group vẫn tồn tại, show notification
        const stillExists = this.groups.find((g) => g.id === activeGroup.id);
        if (stillExists) {
          console.warn(
            `[TabManager] ⚠️ Group "${activeGroup.name}" still exists but has 0 tabs`
          );
        } else {
          console.error(
            `[TabManager] ❌ Group "${activeGroup.name}" was deleted!`
          );
        }

        return;
      }
    }

    const tabsToShow = activeGroup.tabs
      .map((t) => t.id)
      .filter(Boolean) as number[];

    const tabsToHide = allTabs
      .filter(
        (tab: ExtendedTab) =>
          tab.id && !tabsToShow.includes(tab.id) && !isPrivilegedUrl(tab.url) // Bỏ qua privileged URLs
      )
      .map((tab: ExtendedTab) => tab.id) as number[];

    // Prioritize lastActiveTabId, fallback to first tab
    const tabIdToActivate =
      activeGroup.lastActiveTabId &&
      tabsToShow.includes(activeGroup.lastActiveTabId)
        ? activeGroup.lastActiveTabId
        : tabsToShow[0];

    if (tabIdToActivate) {
      try {
        await this.browserAPI.tabs.update(tabIdToActivate, { active: true });
        const tab = await this.browserAPI.tabs.get(tabIdToActivate);
        if (tab.windowId) {
          await this.browserAPI.windows.update(tab.windowId, { focused: true });
        }
      } catch (error) {
        console.error("[TabManager] Failed to activate tab:", error);
      }
    }

    if (tabsToHide.length > 0 && this.browserAPI.tabs.hide) {
      try {
        await this.browserAPI.tabs.hide(tabsToHide);
      } catch (error) {
        console.warn("[TabManager] Failed to hide some tabs:", error);
      }
    }

    // Show tabs from active group
    if (tabsToShow.length > 0 && this.browserAPI.tabs.show) {
      try {
        await this.browserAPI.tabs.show(tabsToShow);
      } catch (error) {
        console.warn("[TabManager] Failed to show some tabs:", error);
      }
    }
  }

  public async createTabInGroup(
    groupId: string,
    url?: string
  ): Promise<ExtendedTab> {
    // QUAN TRỌNG: Load groups từ storage để đảm bảo có data mới nhất
    await this.loadGroups();

    const group = this.groups.find((g) => g.id === groupId);
    if (!group) {
      console.error("[TabManager] Group not found:", groupId);
      throw new Error("Group not found");
    }

    const createProperties: any = { active: false };

    if (group.type === "container") {
      createProperties.cookieStoreId = group.containerId;
    }

    if (url) {
      createProperties.url = url;
    }

    if (this.activeGroupId === groupId) {
      const allTabs = await this.browserAPI.tabs.query({});
      const isPrivilegedUrl = (url: string | undefined): boolean => {
        if (!url) return false;
        return (
          url.startsWith("about:") ||
          url.startsWith("moz-extension:") ||
          url.startsWith("chrome:") ||
          url.startsWith("chrome-extension:")
        );
      };

      const tabsToHide = allTabs
        .filter((tab: ExtendedTab) => tab.id && !isPrivilegedUrl(tab.url))
        .map((tab: ExtendedTab) => tab.id) as number[];

      if (tabsToHide.length > 0 && this.browserAPI.tabs.hide) {
        try {
          await this.browserAPI.tabs.hide(tabsToHide);
        } catch (error) {
          console.warn(
            "[TabManager] Failed to hide some tabs before creation:",
            error
          );
        }
      }
    }

    // Set flag để skip handleTabCreated
    (this as any)._skipNextTabCreated = true;

    const newTab = await this.browserAPI.tabs.create(createProperties);

    // Reset flag ngay sau khi tạo xong
    delete (this as any)._skipNextTabCreated;

    const tabWithGroup = {
      ...newTab,
      groupId,
    };

    if (newTab.id) {
      await this.assignTabToGroup(newTab.id, groupId);
    }

    return tabWithGroup;
  }

  public async getContainers(): Promise<BrowserContainer[]> {
    if (this.browserAPI.contextualIdentities) {
      return await this.browserAPI.contextualIdentities.query({});
    }
    return [];
  }

  private async loadGroups(): Promise<void> {
    const result = await this.browserAPI.storage.local.get(["tabGroups"]);
    this.groups = result.tabGroups || [];
  }

  private async saveGroups(): Promise<void> {
    await this.browserAPI.storage.local.set({ tabGroups: this.groups });
    try {
      await this.broadcastGroupsUpdate();
    } catch (error) {
      console.error("[TabManager] Broadcast error after saveGroups:", error);
    }
  }

  private async loadActiveGroup(): Promise<void> {
    const result = await this.browserAPI.storage.local.get(["activeGroupId"]);
    this.activeGroupId = result.activeGroupId || this.groups[0]?.id || null;
  }

  private async saveActiveGroup(): Promise<void> {
    await this.browserAPI.storage.local.set({
      activeGroupId: this.activeGroupId,
    });
  }

  // Public getters
  public getGroups(): TabGroup[] {
    return this.groups;
  }

  public getActiveGroupId(): string | null {
    return this.activeGroupId;
  }

  public async reloadFromStorage(): Promise<void> {
    console.log("[TabManager] 🔄 Reloading groups from storage...");

    const oldGroupCount = this.groups.length;
    const oldActiveGroupId = this.activeGroupId;

    await this.loadGroups();
    await this.loadActiveGroup();

    console.log("[TabManager] ✅ Reload complete:", {
      oldGroupCount,
      newGroupCount: this.groups.length,
      oldActiveGroupId,
      newActiveGroupId: this.activeGroupId,
      groups: this.groups.map((g) => ({
        id: g.id,
        name: g.name,
        tabCount: g.tabs.length,
      })),
    });

    // Broadcast update to UI
    await this.broadcastGroupsUpdate();
  }

  public async removeMetadataTab(
    groupId: string,
    tabUrl: string,
    tabTitle: string
  ): Promise<void> {
    console.log(`[TabManager] 🗑️ Removing metadata tab:`, {
      groupId,
      url: tabUrl,
      title: tabTitle,
    });

    const group = this.groups.find((g) => g.id === groupId);
    if (!group) {
      console.error(`[TabManager] ❌ Group not found: ${groupId}`);
      return;
    }

    // Tìm và xóa metadata tab
    const tabIndex = group.tabs.findIndex(
      (t) => !t.id && t.url === tabUrl && t.title === tabTitle
    );

    if (tabIndex === -1) {
      console.warn(`[TabManager] ⚠️ Metadata tab not found`);
      return;
    }

    // Xóa tab khỏi array
    group.tabs.splice(tabIndex, 1);

    // Lưu ngay vào storage
    await this.saveGroups();

    console.log(`[TabManager] ✅ Metadata tab removed`);
  }
}
