// File: src/background/tab-manager/index.ts
import { TabGroupManager } from './tab-group-manager';
import { TabOperator } from './tab-operator';
import { StorageManager } from './storage-manager';
import { MessageHandler } from '../messaging/message-handler';

interface BrowserAPI {
    tabs: typeof chrome.tabs & {
        hide(tabIds: number[]): Promise<void>;
        show(tabIds: number[]): Promise<void>;
    };
    runtime: typeof chrome.runtime;
    windows: typeof chrome.windows;
    storage: typeof chrome.storage;
    sidebarAction?: { open: () => Promise<void> };
    contextualIdentities?: { query: (details: any) => Promise<any[]> };
    scripting?: typeof chrome.scripting;
}

export class TabManager {
    private tabGroupManager: TabGroupManager;
    private tabOperator: TabOperator;
    private storageManager: StorageManager;
    private messageHandler: MessageHandler;

    constructor(private browserAPI: BrowserAPI) {
        this.storageManager = new StorageManager(browserAPI);
        this.tabGroupManager = new TabGroupManager(browserAPI, this.storageManager);
        this.tabOperator = new TabOperator(browserAPI, this.storageManager, this.tabGroupManager);
        this.messageHandler = new MessageHandler(browserAPI, this.tabOperator, this.tabGroupManager);

        this.initialize();
    }

    private async initialize(): Promise<void> {
        // Step 1: Load stored data và tạo default group trước
        await this.tabGroupManager.loadStoredData();

        // Step 2: Sync tất cả tabs hiện có SAU KHI đã có default group
        await this.tabOperator.syncAllExistingTabs();

        this.setupEventListeners();
        this.setupMessageHandlers();
        this.setupBeforeUnloadHandler();

        // Show all tabs on extension startup/restart
        await this.tabOperator.showAllTabs();

        console.log('[TabManager] Initialization complete - all existing tabs synced');
    }

    private setupEventListeners(): void {
        this.browserAPI.tabs.onCreated.addListener(this.handleTabCreated.bind(this));
        this.browserAPI.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
        this.browserAPI.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    }

    private setupMessageHandlers(): void {
        this.browserAPI.runtime.onMessage.addListener(
            this.messageHandler.handleMessage.bind(this.messageHandler)
        );
    }

    private setupBeforeUnloadHandler(): void {
        this.browserAPI.runtime.onSuspend?.addListener(() => {
            this.storageManager.saveStoredData();
        });

        setInterval(() => {
            this.storageManager.saveStoredData();
        }, 30000);
    }

    private async handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
        setTimeout(async () => {
            if (tab.id && this.tabOperator.shouldAutoManageTab(tab)) {
                await this.tabOperator.addManagedTab(tab.id, true);
                this.notifySidebar("tabUpdate");
            }
        }, 1000);
    }

    private handleTabRemoved(tabId: number): void {
        if (this.storageManager.isTabManaged(tabId)) {
            this.tabGroupManager.removeTabFromAllGroups(tabId);
            this.storageManager.removeManagedTab(tabId);
            this.storageManager.saveStoredData();
            this.notifySidebar("tabUpdate");
        }
    }

    private handleTabUpdated(tabId: number, changeInfo: any, tab: chrome.tabs.Tab): void {
        if (this.storageManager.isTabManaged(tabId) || this.tabOperator.isClaudeTab(tab)) {
            this.notifySidebar("tabUpdate");
        }

        if (changeInfo.url && this.storageManager.isTabManaged(tabId)) {
            this.notifySidebar("tabUpdate");
        }
    }

    private notifySidebar(action: string): void {
        this.browserAPI.runtime.sendMessage({ action }).catch(() => {
            // Sidebar might not be open, ignore error
        });
    }
}