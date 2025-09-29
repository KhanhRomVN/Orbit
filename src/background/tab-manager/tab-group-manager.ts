// File: src/background/tab-manager/tab-group-manager.ts
import { StorageManager } from './storage-manager';

export interface TabGroup {
    id: string;
    name: string;
    type: "container" | "custom";
    containerCookieStoreId?: string;
    tabIds: number[];
    expanded: boolean;
    color?: string;
    icon?: string;
    created: number;
    lastModified: number;
}

interface BrowserContainer {
    cookieStoreId: string;
    name: string;
    icon: string;
    color: string;
}

interface BrowserAPI {
    contextualIdentities?: {
        query: (details: any) => Promise<BrowserContainer[]>;
    };
    tabs: typeof chrome.tabs;
    storage: typeof chrome.storage;
}

export class TabGroupManager {
    private groups: Map<string, TabGroup> = new Map();

    constructor(
        private browserAPI: BrowserAPI,
        private storageManager: StorageManager
    ) { }

    async loadStoredData(): Promise<void> {
        const data = await this.storageManager.loadStoredData();

        if (data.groups && Array.isArray(data.groups)) {
            data.groups.forEach((group: TabGroup) => {
                this.groups.set(group.id, group);
            });
        }

        // QUAN TRỌNG: Tạo default group TRƯỚC khi init container groups
        await this.ensureDefaultGroup();

        await this.initializeContainerGroups();
        await this.cleanupInvalidData();

        console.log('[TabGroupManager] Loaded groups:', Array.from(this.groups.keys()));
    }

    async initializeContainerGroups(): Promise<void> {
        try {
            let containers: BrowserContainer[] = [];
            if (this.browserAPI.contextualIdentities?.query) {
                containers = await this.browserAPI.contextualIdentities.query({});
            }

            for (const container of containers) {
                const groupId = `container-${container.cookieStoreId}`;
                const existing = this.groups.get(groupId);

                if (!existing) {
                    const newGroup: TabGroup = {
                        id: groupId,
                        name: container.name,
                        type: "container",
                        containerCookieStoreId: container.cookieStoreId,
                        tabIds: [],
                        expanded: true,
                        created: Date.now(),
                        lastModified: Date.now(),
                        icon: container.icon,
                        color: container.color,
                    };
                    this.groups.set(groupId, newGroup);
                } else {
                    // Update container metadata if changed
                    existing.name = container.name;
                    existing.icon = container.icon;
                    existing.color = container.color;
                    existing.lastModified = Date.now();
                    this.groups.set(groupId, existing);
                }
            }

            await this.storageManager.saveStoredData();
        } catch (error) {
            console.error("Error initializing container groups:", error);
        }
    }

    async cleanupInvalidData(): Promise<void> {
        try {
            const allTabs = await this.browserAPI.tabs.query({});
            const validTabIds = new Set(
                allTabs.map((tab) => tab.id).filter((id) => id !== undefined)
            );

            // Remove invalid tabs from groups
            this.groups.forEach((group) => {
                group.tabIds = group.tabIds.filter((id) => validTabIds.has(id));
                group.lastModified = Date.now();
            });

            await this.storageManager.saveStoredData();
        } catch (error) {
            console.error("Error cleaning up invalid data:", error);
        }
    }

    private async ensureDefaultGroup(): Promise<void> {
        // Kiểm tra xem đã có default group chưa
        const defaultGroup = Array.from(this.groups.values()).find(
            g => g.type === "custom" && g.name === "Default Group"
        );

        if (!defaultGroup) {
            const newGroup = await this.createGroup("Default Group", "custom");
            console.log('[TabGroupManager] Created default group:', newGroup.id);
        } else {
            console.log('[TabGroupManager] Default group already exists:', defaultGroup.id);
        }
    }

    async createGroup(
        name: string,
        type: "container" | "custom",
        containerCookieStoreId?: string
    ): Promise<TabGroup> {
        // Validate container group doesn't already exist
        if (type === "container" && containerCookieStoreId) {
            const existingGroup = Array.from(this.groups.values()).find(
                (g) => g.type === "container" && g.containerCookieStoreId === containerCookieStoreId
            );
            if (existingGroup) return existingGroup;
        }

        const groupId = type === "container"
            ? `container-${containerCookieStoreId}`
            : `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const group: TabGroup = {
            id: groupId,
            name,
            type,
            containerCookieStoreId: type === "container" ? containerCookieStoreId : undefined,
            tabIds: [],
            expanded: true,
            created: Date.now(),
            lastModified: Date.now(),
        };

        this.groups.set(groupId, group);

        // QUAN TRỌNG: Lưu storage ngay lập tức với groups hiện tại
        await this.storageManager.saveStoredData(Array.from(this.groups.values()));

        console.log(`[TabGroupManager] Created group: ${groupId} - ${name}`);
        return group;
    }

    async updateGroup(groupId: string, updates: Partial<TabGroup>): Promise<TabGroup | null> {
        const group = this.groups.get(groupId);
        if (!group) return null;

        Object.assign(group, updates, { lastModified: Date.now() });
        this.groups.set(groupId, group);
        await this.storageManager.saveStoredData();
        return group;
    }

    async deleteGroup(groupId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) throw new Error("Group not found");

        this.groups.delete(groupId);
        await this.storageManager.saveStoredData();
    }

    async addTabToGroup(tabId: number, groupId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) return;

        // Remove tab from other groups first (except for custom groups)
        if (group.type === "container") {
            this.removeTabFromAllGroups(tabId);
        }

        if (!group.tabIds.includes(tabId)) {
            group.tabIds.push(tabId);
            group.lastModified = Date.now();
            await this.storageManager.saveStoredData();
        }
    }

    async removeTabFromGroup(tabId: number, groupId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) return;

        group.tabIds = group.tabIds.filter((id) => id !== tabId);
        group.lastModified = Date.now();
        await this.storageManager.saveStoredData();
    }

    removeTabFromAllGroups(tabId: number): void {
        this.groups.forEach((group) => {
            if (group.tabIds.includes(tabId)) {
                group.tabIds = group.tabIds.filter((id) => id !== tabId);
                group.lastModified = Date.now();
            }
        });
    }

    getGroups(): TabGroup[] {
        return Array.from(this.groups.values());
    }

    getGroup(groupId: string): TabGroup | undefined {
        return this.groups.get(groupId);
    }

    isTabInAnyGroup(tabId: number): boolean {
        for (const group of this.groups.values()) {
            if (group.tabIds.includes(tabId)) {
                return true;
            }
        }
        return false;
    }
}