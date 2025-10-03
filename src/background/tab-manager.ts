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
    if (tab.groupId) {
      console.debug(
        "[TabManager] Tab already has groupId, skipping handleTabCreated"
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

    // Nếu có active group, assign tab vào group đó
    if (this.activeGroupId && tab.id) {
      const group = this.groups.find((g) => g.id === this.activeGroupId);
      if (group) {
        let shouldAssign = false;

        // Với container group, chỉ assign nếu tab có cùng cookieStoreId
        if (group.type === "container") {
          shouldAssign = tab.cookieStoreId === group.containerId;
        } else {
          // Với custom group, assign tất cả tab không có container
          shouldAssign =
            !tab.cookieStoreId || tab.cookieStoreId === "firefox-default";
        }

        if (shouldAssign) {
          await this.assignTabToGroup(tab.id, this.activeGroupId);
          // Broadcast chỉ 1 lần sau khi assign xong
          await this.broadcastGroupsUpdate();
        }
      }
    }
  }

  private async broadcastGroupsUpdate(): Promise<void> {
    try {
      // Đảm bảo dữ liệu mới nhất trước khi broadcast
      await this.loadGroups();
      await this.loadActiveGroup();

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

  public async setActiveGroup(groupId: string): Promise<void> {
    this.activeGroupId = groupId;
    await this.saveActiveGroup();
    await this.showActiveGroupTabs();
  }

  private async showActiveGroupTabs(): Promise<void> {
    if (!this.activeGroupId) {
      return;
    }

    const allTabs = await this.browserAPI.tabs.query({});

    const activeGroup = this.groups.find((g) => g.id === this.activeGroupId);

    if (!activeGroup) {
      return;
    }

    const isPrivilegedUrl = (_url: string | undefined): boolean => {
      return false;
    };

    if (activeGroup.tabs.length === 0) {
      const newTab = await this.createTabInGroup(this.activeGroupId);
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

    const tabsToHide = allTabs
      .filter(
        (tab: ExtendedTab) =>
          tab.id && !tabsToShow.includes(tab.id) && !isPrivilegedUrl(tab.url) // Bỏ qua privileged URLs
      )
      .map((tab: ExtendedTab) => tab.id) as number[];

    const firstTabId = tabsToShow[0];
    if (firstTabId) {
      try {
        await this.browserAPI.tabs.update(firstTabId, { active: true });
        const tab = await this.browserAPI.tabs.get(firstTabId);
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

    const newTab = await this.browserAPI.tabs.create(createProperties);

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
