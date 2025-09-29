// File: src/background/messaging/message-handler.ts
import { TabOperator } from '../tab-manager/tab-operator';
import { TabGroupManager } from '../tab-manager/tab-group-manager';

interface BrowserAPI {
    tabs: typeof chrome.tabs;
    runtime: typeof chrome.runtime;
}

export class MessageHandler {
    constructor(
        private browserAPI: BrowserAPI,
        private tabOperator: TabOperator,
        private tabGroupManager: TabGroupManager
    ) { }

    handleMessage(request: any, _sender: any, sendResponse: (response: any) => void): boolean {
        // Sử dụng async IIFE để xử lý async operations
        (async () => {
            try {
                console.log("[DEBUG] MessageHandler: Received action:", request.action);
                const response = await this.processMessage(request);
                console.log("[DEBUG] MessageHandler: Sending response:", response);
                sendResponse(response);
            } catch (error) {
                console.error("Background: Error handling message:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                sendResponse({ success: false, error: errorMessage });
            }
        })();

        // Return true để keep message channel open cho async response
        return true;
    }

    private async processMessage(request: any): Promise<any> {
        switch (request.action) {
            case "createTab":
                const newTab = await this.tabOperator.createTab(
                    request.containerCookieStoreId,
                    request.groupId
                );
                return { success: true, tab: newTab };

            case "markTabAsSidebarCreated":
                // This is now handled by StorageManager
                return { success: true };

            case "getGroups":
                const groups = await this.getGroupsWithTabs();
                return { success: true, groups };

            case "createGroup":
                const group = await this.tabGroupManager.createGroup(
                    request.name,
                    request.type,
                    request.containerCookieStoreId
                );
                return { success: true, group };

            case "updateGroup":
                const updatedGroup = await this.tabGroupManager.updateGroup(
                    request.groupId,
                    request.updates
                );
                return { success: true, group: updatedGroup };

            case "deleteGroup":
                await this.tabGroupManager.deleteGroup(request.groupId);
                return { success: true };

            case "addTabToGroup":
                await this.tabGroupManager.addTabToGroup(request.tabId, request.groupId);
                return { success: true };

            case "removeTabFromGroup":
                await this.tabGroupManager.removeTabFromGroup(request.tabId, request.groupId);
                return { success: true };

            case "focusTab":
                await this.tabOperator.focusTab(request.tabId);
                return { success: true };

            case "sendPrompt":
                return await this.tabOperator.sendPromptToTab(request.tabId, request.prompt);

            case "addManagedTab":
                await this.tabOperator.addManagedTab(request.tabId, false);
                return { success: true };

            case "removeManagedTab":
                await this.tabOperator.removeManagedTab(request.tabId);
                return { success: true };

            case "openSidebar":
                await this.tabOperator.openSidebar();
                return { success: true };

            case "openTabManager":
                await this.tabOperator.openTabManager();
                return { success: true };

            case "focusGroup":
                await this.tabOperator.hideTabsExceptGroup(request.groupId);
                return { success: true };

            case "showAllTabs":
                await this.tabOperator.showAllTabs();
                return { success: true };

            default:
                return { success: false, error: "Unknown action" };
        }
    }

    private async getGroupsWithTabs(): Promise<any[]> {
        await this.tabGroupManager.initializeContainerGroups();
        await this.tabGroupManager.cleanupInvalidData();

        const allTabs = await this.browserAPI.tabs.query({});
        const managedTabs = this.tabGroupManager.getGroups().reduce((acc, group) => {
            group.tabIds.forEach(tabId => acc.add(tabId));
            return acc;
        }, new Set<number>());

        const claudeTabs = allTabs.filter((tab: any) => tab.id && managedTabs.has(tab.id));

        // Get container information
        let containers: any[] = [];
        try {
            // This would need to be passed from the main class
        } catch (error) {
            console.error("Error fetching containers:", error);
        }

        // Build groups with their tabs
        const groupsWithTabs = this.tabGroupManager.getGroups().map((group) => {
            const groupTabs = claudeTabs
                .filter((tab) => group.tabIds.includes(tab.id!))
                .map((tab: any) => {
                    const cookieStoreId = tab.cookieStoreId || "firefox-default";
                    const container = containers.find((c) => c.cookieStoreId === cookieStoreId);

                    return {
                        id: tab.id || 0,
                        title: tab.title || "Untitled Tab",
                        url: tab.url || "",
                        active: tab.active || false,
                        container: cookieStoreId,
                        containerName: container?.name || "Default",
                        containerIcon: container?.icon || "default",
                        containerColor: container?.color || "gray",
                    };
                });

            return {
                ...group,
                tabs: groupTabs,
            };
        });

        // Sort groups: container groups first, then custom groups
        return groupsWithTabs.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === "container" ? -1 : 1;
            }
            if (a.name === "Default Container") return -1;
            if (b.name === "Default Container") return 1;
            return a.name.localeCompare(b.name);
        });
    }
}