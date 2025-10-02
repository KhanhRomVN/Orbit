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
    // Gửi message đến tất cả sidebar/popup đang mở
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

  private async handleTabActivated(_activeInfo: any) {
    // Update active tab in groups
    // This could be used for UI updates
  }

  public async initializeDefaultGroups() {
    console.log(
      "[TabManager] initializeDefaultGroups called - creating Temp group"
    );

    const allTabs = await this.browserAPI.tabs.query({});
    console.log(
      "[TabManager] Found existing tabs:",
      allTabs.length,
      allTabs.map((t: { id: any; title: any }) => ({
        id: t.id,
        title: t.title,
      }))
    );

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

    console.log(
      "[TabManager] Temp group created with tabs:",
      tempGroup.tabs.length
    );
    console.log("[TabManager] Active group set to:", this.activeGroupId);

    // Show only tabs from active group
    await this.showActiveGroupTabs();
  }

  public async createGroup(
    groupData: Omit<TabGroup, "id" | "tabs" | "createdAt">
  ): Promise<TabGroup> {
    console.log("[DEBUG] Creating group with data:", groupData);

    // ĐẢM BẢO load groups mới nhất từ storage trước khi thêm
    await this.loadGroups();

    const newGroup: TabGroup = {
      ...groupData,
      id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tabs: [],
      createdAt: Date.now(),
    };

    console.log("[DEBUG] New group created:", newGroup);
    console.log("[DEBUG] Current groups before adding:", this.groups);

    // THÊM group mới vào mảng groups hiện có (không ghi đè)
    this.groups.push(newGroup);
    await this.saveGroups();

    console.log("[DEBUG] Groups after save:", this.groups);
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
    console.log(
      "[TabManager] setActiveGroup called - switching to group:",
      groupId
    );
    console.log("[TabManager] Previous active group:", this.activeGroupId);

    this.activeGroupId = groupId;
    await this.saveActiveGroup();

    console.log("[TabManager] Active group saved, now showing tabs");
    await this.showActiveGroupTabs();
  }

  private async showActiveGroupTabs(): Promise<void> {
    console.log(
      "[TabManager] showActiveGroupTabs called - activeGroupId:",
      this.activeGroupId
    );

    if (!this.activeGroupId) {
      console.log("[TabManager] No active group, returning");
      return;
    }

    const allTabs = await this.browserAPI.tabs.query({});
    console.log(
      "[TabManager] All tabs before filtering:",
      allTabs.map((t: { id: any; title: any }) => ({
        id: t.id,
        title: t.title,
      }))
    );

    const activeGroup = this.groups.find((g) => g.id === this.activeGroupId);
    console.log(
      "[TabManager] Active group found:",
      activeGroup?.name,
      "with tabs:",
      activeGroup?.tabs.length
    );

    if (!activeGroup) {
      console.log("[TabManager] Active group not found, returning");
      return;
    }

    const isPrivilegedUrl = (_url: string | undefined): boolean => {
      return false;
    };

    // Nếu group rỗng, tạo tab mới và ẩn tất cả tab khác
    if (activeGroup.tabs.length === 0) {
      console.log(
        "[TabManager] Active group has no tabs, creating new tab and hiding others"
      );

      // TẠO TAB MỚI TRƯỚC, rồi mới ẩn tab cũ
      console.log("[TabManager] Creating new tab in active group");
      const newTab = await this.createTabInGroup(this.activeGroupId);

      // KÍCH HOẠT TAB MỚI ngay lập tức trước khi ẩn tab cũ
      if (newTab.id) {
        console.log(
          "[TabManager] Activating new tab before hiding others:",
          newTab.id
        );
        await this.browserAPI.tabs.update(newTab.id, { active: true });
        // Đảm bảo cửa sổ được focus
        if (newTab.windowId) {
          await this.browserAPI.windows.update(newTab.windowId, {
            focused: true,
          });
        }

        // Đợi một chút để đảm bảo tab mới đã được kích hoạt
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // SAU KHI TAB MỚI ĐÃ ĐƯỢC KÍCH HOẠT, mới ẩn các tab cũ
      const tabsToHide = allTabs
        .filter((tab: ExtendedTab) => {
          // KHÔNG ẩn tab mới vừa tạo
          const shouldHide =
            tab.id && tab.id !== newTab.id && !isPrivilegedUrl(tab.url);
          console.log(
            `[TabManager] Tab ${tab.id} (${tab.url}) - hide: ${shouldHide}`
          );
          return shouldHide;
        })
        .map((tab: ExtendedTab) => tab.id) as number[];

      console.log("[TabManager] Tabs to hide (excluding new tab):", tabsToHide);

      if (tabsToHide.length > 0 && this.browserAPI.tabs.hide) {
        try {
          console.log("[TabManager] Hiding tabs:", tabsToHide);
          await this.browserAPI.tabs.hide(tabsToHide);
          console.log("[TabManager] Successfully hid tabs");
        } catch (error) {
          console.warn("[TabManager] Failed to hide some tabs:", error);
        }
      } else {
        console.log("[TabManager] No tabs to hide or hide API not available");
      }
      return;
    }

    const tabsToShow = activeGroup.tabs
      .map((t) => t.id)
      .filter(Boolean) as number[];
    console.log("[TabManager] Tabs to show from active group:", tabsToShow);

    const tabsToHide = allTabs
      .filter(
        (tab: ExtendedTab) =>
          tab.id && !tabsToShow.includes(tab.id) && !isPrivilegedUrl(tab.url) // Bỏ qua privileged URLs
      )
      .map((tab: ExtendedTab) => tab.id) as number[];

    console.log("[TabManager] Tabs to hide from other groups:", tabsToHide);

    // BƯỚC QUAN TRỌNG: Kích hoạt một tab từ group mới trước khi ẩn các tab cũ
    const firstTabId = tabsToShow[0];
    if (firstTabId) {
      console.log("[TabManager] Activating tab:", firstTabId);
      try {
        await this.browserAPI.tabs.update(firstTabId, { active: true });
        // Đảm bảo cửa sổ được focus
        const tab = await this.browserAPI.tabs.get(firstTabId);
        if (tab.windowId) {
          await this.browserAPI.windows.update(tab.windowId, { focused: true });
        }
        console.log("[TabManager] Successfully activated tab from new group");
      } catch (error) {
        console.error("[TabManager] Failed to activate tab:", error);
      }
    }

    // Hide tabs from other groups
    if (tabsToHide.length > 0 && this.browserAPI.tabs.hide) {
      try {
        await this.browserAPI.tabs.hide(tabsToHide);
        console.log("[TabManager] Successfully hid tabs from other groups");
      } catch (error) {
        console.warn("[TabManager] Failed to hide some tabs:", error);
      }
    }

    // Show tabs from active group
    if (tabsToShow.length > 0 && this.browserAPI.tabs.show) {
      try {
        await this.browserAPI.tabs.show(tabsToShow);
        console.log("[TabManager] Successfully showed tabs from active group");
      } catch (error) {
        console.warn("[TabManager] Failed to show some tabs:", error);
      }
    }
  }

  public async createTabInGroup(
    groupId: string,
    url?: string
  ): Promise<ExtendedTab> {
    console.log("[TabManager] createTabInGroup called:", {
      groupId,
      url,
      timestamp: Date.now(),
    });

    const group = this.groups.find((g) => g.id === groupId);
    if (!group) {
      console.error("[TabManager] Group not found:", groupId);
      throw new Error("Group not found");
    }

    console.log("[TabManager] Group found:", group.name);

    const createProperties: any = { active: false };

    if (group.type === "container") {
      createProperties.cookieStoreId = group.containerId;
      console.log("[TabManager] Using container:", group.containerId);
    }

    if (url) {
      createProperties.url = url;
    }

    console.log("[TabManager] Creating tab with properties:", createProperties);

    // Nếu đây là group active, ẩn tất cả tab khác trước khi tạo tab mới
    if (this.activeGroupId === groupId) {
      console.log("[TabManager] This is active group, hiding other tabs first");
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

      console.log(
        "[TabManager] Tabs to hide before creating new tab:",
        tabsToHide
      );

      if (tabsToHide.length > 0 && this.browserAPI.tabs.hide) {
        try {
          await this.browserAPI.tabs.hide(tabsToHide);
          console.log(
            "[TabManager] Successfully hid tabs before creating new one"
          );
        } catch (error) {
          console.warn(
            "[TabManager] Failed to hide some tabs before creation:",
            error
          );
        }
      }
    }

    const newTab = await this.browserAPI.tabs.create(createProperties);
    console.log("[TabManager] New tab created:", newTab.id, newTab.title);

    // Gán groupId ngay lập tức cho tab object
    const tabWithGroup = {
      ...newTab,
      groupId,
    };

    // Assign vào group
    if (newTab.id) {
      console.log("[TabManager] Assigning tab to group");
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
