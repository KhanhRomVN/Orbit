// File: src/background/tab-manager/storage-manager.ts
export interface GroupStorage {
    groups: any[];
    managedTabs: number[];
    sidebarCreatedTabs: number[];
}

interface BrowserAPI {
    storage: typeof chrome.storage;
}

export class StorageManager {
    private managedTabs: Set<number> = new Set();
    private sidebarCreatedTabs: Set<number> = new Set();

    constructor(private browserAPI: BrowserAPI) { }

    async loadStoredData(): Promise<GroupStorage> {
        const result = await this.browserAPI.storage.local.get([
            "managedTabs",
            "sidebarCreatedTabs",
            "groups",
        ]);

        if (result.managedTabs && Array.isArray(result.managedTabs)) {
            this.managedTabs = new Set(result.managedTabs);
        }
        if (result.sidebarCreatedTabs && Array.isArray(result.sidebarCreatedTabs)) {
            this.sidebarCreatedTabs = new Set(result.sidebarCreatedTabs);
        }

        return result as GroupStorage;
    }

    async saveStoredData(groups: any[] = []): Promise<void> {
        const data: GroupStorage = {
            groups,
            managedTabs: Array.from(this.managedTabs),
            sidebarCreatedTabs: Array.from(this.sidebarCreatedTabs),
        };
        await this.browserAPI.storage.local.set(data);
    }

    addManagedTab(tabId: number, isSidebarCreated: boolean = false): void {
        this.managedTabs.add(tabId);
        if (isSidebarCreated) {
            this.sidebarCreatedTabs.add(tabId);
        }
    }

    removeManagedTab(tabId: number): void {
        this.managedTabs.delete(tabId);
        this.sidebarCreatedTabs.delete(tabId);
    }

    isTabManaged(tabId: number): boolean {
        return this.managedTabs.has(tabId);
    }

    isSidebarCreatedTab(tabId: number): boolean {
        return this.sidebarCreatedTabs.has(tabId);
    }

    getManagedTabs(): number[] {
        return Array.from(this.managedTabs);
    }

    getSidebarCreatedTabs(): number[] {
        return Array.from(this.sidebarCreatedTabs);
    }
}