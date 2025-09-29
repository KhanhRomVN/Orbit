// File: src/background/tab-manager/tab-operator.ts
import { StorageManager } from './storage-manager';
import { TabGroupManager } from './tab-group-manager';

interface BrowserAPI {
    tabs: typeof chrome.tabs & {
        hide(tabIds: number[]): Promise<void>;
        show(tabIds: number[]): Promise<void>;
    };
    windows: typeof chrome.windows;
    storage: typeof chrome.storage;
    sidebarAction?: { open: () => Promise<void> };
    scripting?: typeof chrome.scripting;
    runtime: typeof chrome.runtime;
}

export class TabOperator {
    private hiddenTabs: Set<number> = new Set();

    constructor(
        private browserAPI: BrowserAPI,
        private storageManager: StorageManager,
        private tabGroupManager: TabGroupManager
    ) { }

    async createTab(cookieStoreId?: string, groupId?: string): Promise<chrome.tabs.Tab> {
        const tabOptions: any = { active: true };

        if (cookieStoreId && cookieStoreId !== "firefox-default") {
            tabOptions.cookieStoreId = cookieStoreId;
        }

        const tab = await this.browserAPI.tabs.create(tabOptions);

        if (tab.id) {
            this.storageManager.addManagedTab(tab.id, true);

            // Add to group if specified
            if (groupId) {
                await this.tabGroupManager.addTabToGroup(tab.id, groupId);
            }

            await this.storageManager.saveStoredData();
        }

        return tab;
    }

    async addManagedTab(tabId: number, isSidebarCreated: boolean = false): Promise<void> {
        this.storageManager.addManagedTab(tabId, isSidebarCreated);

        try {
            const tab = await this.browserAPI.tabs.get(tabId);
            const cookieStoreId = (tab as any).cookieStoreId || "firefox-default";
            const containerGroupId = `container-${cookieStoreId}`;

            // Priority 1: Thêm vào container group nếu tồn tại
            const containerGroup = this.tabGroupManager.getGroup(containerGroupId);
            if (containerGroup) {
                await this.tabGroupManager.addTabToGroup(tabId, containerGroupId);
                console.log(`[TabOperator] Added tab ${tabId} to container group: ${containerGroup.name}`);
            }

            // Priority 2: Nếu không có container group, thêm vào default custom group
            if (!containerGroup || !this.tabGroupManager.isTabInAnyGroup(tabId)) {
                const defaultGroup = this.tabGroupManager.getGroups().find(g => g.type === "custom");
                if (defaultGroup) {
                    await this.tabGroupManager.addTabToGroup(tabId, defaultGroup.id);
                    console.log(`[TabOperator] Added tab ${tabId} to default custom group: ${defaultGroup.name}`);
                } else {
                    console.error(`[TabOperator] ERROR: No default custom group found! Cannot add tab ${tabId}`);
                }
            }
        } catch (error) {
            console.error("Error auto-assigning tab to group:", error);
        }

        await this.storageManager.saveStoredData();
    }

    async removeManagedTab(tabId: number): Promise<void> {
        this.tabGroupManager.removeTabFromAllGroups(tabId);
        this.storageManager.removeManagedTab(tabId);
        await this.storageManager.saveStoredData();
    }

    async focusTab(tabId: number): Promise<void> {
        const tab = await this.browserAPI.tabs.get(tabId);
        await this.browserAPI.tabs.update(tabId, { active: true });
        await this.browserAPI.windows.update(tab.windowId!, { focused: true });
    }

    async hideTabsExceptGroup(activeGroupId: string): Promise<void> {
        try {
            await this.syncManagedTabsWithCurrentTabs();

            const allTabs = await this.browserAPI.tabs.query({});
            const managedTabIds = this.storageManager.getManagedTabs();
            const activeGroup = this.tabGroupManager.getGroup(activeGroupId);
            const activeGroupTabIds = activeGroup ? activeGroup.tabIds : [];

            const tabsToHide: number[] = [];
            const tabsToShow: number[] = [];

            // Always show tabs from active group
            if (activeGroup) {
                tabsToShow.push(...activeGroup.tabIds.filter(id => managedTabIds.includes(id)));
            }

            // Hide managed tabs that don't belong to active group
            for (const tab of allTabs) {
                if (tab.id && managedTabIds.includes(tab.id) && !activeGroupTabIds.includes(tab.id)) {
                    tabsToHide.push(tab.id);
                }
            }

            // Hide tabs from other groups
            if (tabsToHide.length > 0) {
                await this.browserAPI.tabs.hide(tabsToHide);
                tabsToHide.forEach(id => this.hiddenTabs.add(id));
            }

            // Show tabs from active group
            if (tabsToShow.length > 0) {
                await this.browserAPI.tabs.show(tabsToShow);
                tabsToShow.forEach(id => this.hiddenTabs.delete(id));
            }
        } catch (error) {
            console.error("Error hiding/showing tabs:", error);
        }
    }

    async showAllTabs(): Promise<void> {
        try {
            if (this.hiddenTabs.size > 0) {
                const hiddenTabIds = Array.from(this.hiddenTabs);
                await this.browserAPI.tabs.show(hiddenTabIds);
                this.hiddenTabs.clear();
            }
        } catch (error) {
            console.error("Error showing all tabs:", error);
        }
    }

    async sendPromptToTab(tabId: number, prompt: string): Promise<{ success: boolean; response?: string }> {
        try {
            if (!this.storageManager.isTabManaged(tabId)) {
                return {
                    success: false,
                    response: "Tab is not managed by sidebar. Please use the sidebar to open Claude tabs.",
                };
            }

            await this.ensureContentScriptInjected(tabId);

            const response = await this.browserAPI.tabs.sendMessage(tabId, {
                action: "sendPrompt",
                prompt: prompt,
            });

            return response;
        } catch (error) {
            console.error("Error sending prompt to tab:", error);
            return { success: false };
        }
    }

    async openSidebar(): Promise<void> {
        if (this.browserAPI.sidebarAction?.open) {
            await this.browserAPI.sidebarAction.open();
        } else {
            console.warn("Sidebar API not available");
        }
    }

    async openTabManager(): Promise<void> {
        const existingTabs = await this.browserAPI.tabs.query({
            url: this.browserAPI.runtime.getURL("index.html"),
        });

        if (existingTabs.length > 0) {
            await this.focusTab(existingTabs[0].id!);
        } else {
            await this.browserAPI.tabs.create({
                url: this.browserAPI.runtime.getURL("index.html"),
                active: true,
            });
        }
    }

    shouldAutoManageTab(tab: chrome.tabs.Tab): boolean {
        // Loại trừ tab extension pages
        const isExtensionPage = tab.url?.startsWith('moz-extension://') ||
            tab.url?.startsWith('chrome-extension://');

        // Loại trừ chỉ một số about: pages quan trọng của browser
        const isCriticalBrowserPage = tab.url?.startsWith('about:preferences') ||
            tab.url?.startsWith('about:config') ||
            tab.url?.startsWith('about:addons');

        const alreadyManaged = tab.id ? this.storageManager.isTabManaged(tab.id) : false;

        // Chấp nhận mọi tab khác, bao gồm cả about:blank, about:newtab, và tất cả website
        return !isExtensionPage && !isCriticalBrowserPage && !alreadyManaged;
    }

    async syncAllExistingTabs(): Promise<void> {
        try {
            const allTabs = await this.browserAPI.tabs.query({});

            for (const tab of allTabs) {
                if (!tab.id) continue;

                // Bỏ qua các tab đã được quản lý
                if (this.storageManager.isTabManaged(tab.id)) continue;

                // Kiểm tra tab có hợp lệ không (loại trừ internal browser pages)
                if (this.shouldAutoManageTab(tab)) {
                    await this.addManagedTab(tab.id, false);
                    console.log(`[TabOperator] Auto-synced existing tab: ${tab.id} - ${tab.url}`);
                }
            }

            await this.storageManager.saveStoredData();
            console.log('[TabOperator] Finished syncing all existing tabs');
        } catch (error) {
            console.error('[TabOperator] Error syncing existing tabs:', error);
        }
    }

    isClaudeTab(tab: chrome.tabs.Tab): boolean {
        if (!tab.url) return false;

        const claudePatterns = [
            /https?:\/\/claude\.ai/i,
            /https?:\/\/.*\.claude\.ai/i,
        ];

        return claudePatterns.some((pattern) => pattern.test(tab.url!));
    }

    private async syncManagedTabsWithCurrentTabs(): Promise<void> {
        try {
            const allTabs = await this.browserAPI.tabs.query({});
            const currentTabIds = new Set(allTabs.map(tab => tab.id).filter(id => id !== undefined) as number[]);

            // Remove tabs that no longer exist
            const managedTabs = this.storageManager.getManagedTabs();
            for (const tabId of managedTabs) {
                if (!currentTabIds.has(tabId)) {
                    this.storageManager.removeManagedTab(tabId);
                    this.hiddenTabs.delete(tabId);
                    this.tabGroupManager.removeTabFromAllGroups(tabId);
                }
            }

            // Ensure all tabs in groups are still managed
            for (const group of this.tabGroupManager.getGroups()) {
                for (const tabId of group.tabIds) {
                    if (currentTabIds.has(tabId)) {
                        this.storageManager.addManagedTab(tabId, false);
                    }
                }
            }
        } catch (error) {
            console.error("Error syncing managed tabs:", error);
        }
    }

    private async ensureContentScriptInjected(tabId: number): Promise<void> {
        try {
            await this.browserAPI.tabs.sendMessage(tabId, { action: "ping" });
        } catch (error) {
            if (this.browserAPI.scripting && this.browserAPI.scripting.executeScript) {
                await this.browserAPI.scripting.executeScript({
                    target: { tabId },
                    files: ["claude-content.js"],
                });
            } else {
                await (this.browserAPI.tabs as any).executeScript(tabId, {
                    file: "claude-content.js",
                });
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
}