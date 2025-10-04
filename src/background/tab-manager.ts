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
      console.debug(
        "[TabManager] Skipping handleTabCreated due to manual creation"
      );
      return;
    }

    // Bỏ qua nếu tab này đã được assign rồi (tránh duplicate)
    const alreadyAssigned = this.groups.some((g) =>
      g.tabs.some((t) => t.id === tab.id)
    );

    if (alreadyAssigned) {
      console.debug(
        "[TabManager] Tab already assigned, skipping handleTabCreated"
      );
      return;
    }

    console.debug(
      "[TabManager] 📝 New tab created, checking for active group assignment:",
      {
        tabId: tab.id,
        activeGroupId: this.activeGroupId,
        tabUrl: tab.url,
        tabCookieStoreId: tab.cookieStoreId,
      }
    );

    // Nếu có active group, assign tab vào group đó
    if (this.activeGroupId && tab.id) {
      const group = this.groups.find((g) => g.id === this.activeGroupId);
      if (group) {
        // XỬ LÝ CONTAINER GROUP: Nếu tab không đúng container, xóa và tạo lại
        if (group.type === "container") {
          const hasCorrectContainer = tab.cookieStoreId === group.containerId;

          console.debug(`[TabManager] 🔍 Container group check:`, {
            groupName: group.name,
            tabCookieStoreId: tab.cookieStoreId,
            groupContainerId: group.containerId,
            hasCorrectContainer,
          });

          if (!hasCorrectContainer) {
            console.debug(
              `[TabManager] 🔄 Tab has wrong container, recreating with correct container...`
            );

            try {
              // Lưu lại URL nếu có
              const tabUrl =
                tab.url && !tab.url.startsWith("about:") ? tab.url : undefined;

              // Xóa tab sai container
              await this.browserAPI.tabs.remove(tab.id);
              console.debug(
                `[TabManager] ❌ Removed tab ${tab.id} with wrong container`
              );

              // Tạo tab mới với container đúng
              const newTab = await this.createTabInGroup(group.id, tabUrl);
              console.debug(
                `[TabManager] ✅ Created new tab ${newTab.id} with correct container`
              );

              return; // Dừng xử lý vì đã tạo tab mới
            } catch (error) {
              console.error(
                "[TabManager] ❌ Failed to recreate tab with container:",
                error
              );
              return;
            }
          }

          // Tab đã có đúng container, assign bình thường
          console.debug(
            `[TabManager] ✅ Assigning tab ${tab.id} to container group: ${group.name}`
          );
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
          // CUSTOM GROUP: Luôn assign tab mới
          console.debug(`[TabManager] 🔍 Custom group check:`, {
            groupName: group.name,
            groupType: group.type,
          });

          console.debug(
            `[TabManager] ✅ Assigning tab ${tab.id} to custom group: ${group.name}`
          );
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
    } else {
      console.debug(
        `[TabManager] ℹ️ No active group or tab ID, skipping assignment`,
        {
          hasActiveGroup: !!this.activeGroupId,
          hasTabId: !!tab.id,
        }
      );
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
          console.debug(
            "[TabManager] No receivers for groupsUpdate (expected)"
          );
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
    await this.saveGroups();

    // Show only tabs from active group
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
    if (groupIndex === -1) return;

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
    console.debug(`[TabManager] 🔄 Assigning tab ${tabId} to group ${groupId}`);

    // Remove tab from any existing group
    for (const group of this.groups) {
      const tabIndex = group.tabs.findIndex((t) => t.id === tabId);
      if (tabIndex > -1) {
        console.debug(
          `[TabManager] ➖ Removed tab ${tabId} from group ${group.name}`
        );
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
      console.debug(
        `[TabManager] ➕ Added tab ${tabId} to group ${targetGroup.name}, total tabs: ${targetGroup.tabs.length}`
      );
      await this.saveGroups();
      console.debug(`[TabManager] ✅ Tab assignment saved to storage`);
    }
  }

  public async setActiveGroup(groupId: string): Promise<void> {
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
    const caller = new Error().stack?.split("\n")[2]?.trim();
    console.debug(
      "[TabManager] 🔵 showActiveGroupTabs() started, called from:",
      caller
    );

    if (!this.activeGroupId) {
      console.debug("[TabManager] ❌ No active group, returning");
      return;
    }

    // KHÔNG reload groups ở đây để tránh race condition
    // Data đã được đồng bộ qua saveGroups() và broadcastGroupsUpdate()
    console.debug(
      "[TabManager] 📊 Using current groups, count:",
      this.groups.length
    );

    const allTabs = await this.browserAPI.tabs.query({});
    console.debug("[TabManager] 📋 All tabs count:", allTabs.length);

    const activeGroup = this.groups.find((g) => g.id === this.activeGroupId);

    if (!activeGroup) {
      console.debug(
        "[TabManager] ❌ Active group not found:",
        this.activeGroupId
      );
      return;
    }

    console.debug("[TabManager] ✅ Active group found:", {
      groupName: activeGroup.name,
      groupId: activeGroup.id,
      tabsCount: activeGroup.tabs.length,
      tabIds: activeGroup.tabs.map((t) => t.id),
    });

    const isPrivilegedUrl = (_url: string | undefined): boolean => {
      return false;
    };

    if (activeGroup.tabs.length === 0) {
      console.debug("[TabManager] 🆕 Group is empty, creating new tab...");
      // Tạm thời tắt auto-assign trong handleTabCreated
      const skipNextTabCreated = true;
      (this as any)._skipNextTabCreated = skipNextTabCreated;

      const newTab = await this.createTabInGroup(this.activeGroupId);

      // Xóa flag sau khi tạo xong
      delete (this as any)._skipNextTabCreated;

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
        } catch (error) {
          console.warn("[TabManager] Failed to hide some tabs:", error);
        }
      }

      return;
    }

    const tabsToShow = activeGroup.tabs
      .map((t) => t.id)
      .filter(Boolean) as number[];

    console.debug("[TabManager] 👁️ Tabs to show:", tabsToShow);

    const tabsToHide = allTabs
      .filter(
        (tab: ExtendedTab) =>
          tab.id && !tabsToShow.includes(tab.id) && !isPrivilegedUrl(tab.url) // Bỏ qua privileged URLs
      )
      .map((tab: ExtendedTab) => tab.id) as number[];

    console.debug("[TabManager] 🙈 Tabs to hide:", tabsToHide);

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
      console.debug("[TabManager] Broadcast failed, but continuing:", error);
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

  public getGroupTabs(groupId: string): ExtendedTab[] {
    const group = this.groups.find((g) => g.id === groupId);
    return group ? group.tabs : [];
  }
}
