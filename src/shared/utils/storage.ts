// src/shared/utils/storage.ts
import { ClipboardItem, ClipboardFolder } from '../../types/clipboard';

interface AppSettings {
    theme: 'light' | 'dark' | 'system';
    autoCapture: boolean;
    maxItems: number;
    shortcuts: {
        pasteFavorite: string;
        openPopup: string;
    };
    notifications: boolean;
    syncEnabled: boolean;
}

interface PasteEvent {
    id: string;
    itemId: string;
    timestamp: number;
    url?: string;
    success: boolean;
    errorMessage?: string;
}

const STORAGE_KEYS = {
    // Using the same keys as clipboard-storage.ts for consistency
    ITEMS: 'clipboard_items_v3',
    FOLDERS: 'clipboard_folders_v3',
    SETTINGS: 'shortcutpaste_settings',
    HISTORY: 'shortcutpaste_history'
} as const;

export const storage = {
    // Clipboard Items - delegated to clipboard-storage.ts for consistency
    async getClipboardItems(): Promise<ClipboardItem[]> {
        try {
            // Check local storage first (more persistent)
            const localResult = await chrome.storage.local.get(STORAGE_KEYS.ITEMS);
            if (localResult[STORAGE_KEYS.ITEMS]) {
                return localResult[STORAGE_KEYS.ITEMS];
            }

            // Fallback to sync storage
            const syncResult = await chrome.storage.sync.get(STORAGE_KEYS.ITEMS);
            if (syncResult[STORAGE_KEYS.ITEMS]) {
                return syncResult[STORAGE_KEYS.ITEMS];
            }

            return [];
        } catch (error) {
            console.error('Failed to get clipboard items:', error);
            return [];
        }
    },

    async saveClipboardItems(items: ClipboardItem[]): Promise<void> {
        try {
            // Always save to local storage first
            await chrome.storage.local.set({ [STORAGE_KEYS.ITEMS]: items });

            // Also try to sync if data is small enough
            const itemsSize = new Blob([JSON.stringify(items)]).size;
            if (itemsSize <= 80000) {
                try {
                    await chrome.storage.sync.set({ [STORAGE_KEYS.ITEMS]: items });
                } catch (syncError) {
                    console.warn('Sync storage failed, but local storage succeeded:', syncError);
                }
            }
        } catch (error) {
            console.error('Failed to save clipboard items:', error);
            throw error;
        }
    },

    // Clipboard Folders - delegated to clipboard-storage.ts for consistency
    async getClipboardFolders(): Promise<ClipboardFolder[]> {
        try {
            // Check local storage first
            const localResult = await chrome.storage.local.get(STORAGE_KEYS.FOLDERS);
            if (localResult[STORAGE_KEYS.FOLDERS]) {
                return localResult[STORAGE_KEYS.FOLDERS];
            }

            // Fallback to sync storage
            const syncResult = await chrome.storage.sync.get(STORAGE_KEYS.FOLDERS);
            if (syncResult[STORAGE_KEYS.FOLDERS]) {
                return syncResult[STORAGE_KEYS.FOLDERS];
            }

            return [];
        } catch (error) {
            console.error('Failed to get clipboard folders:', error);
            return [];
        }
    },

    async saveClipboardFolders(folders: ClipboardFolder[]): Promise<void> {
        try {
            // Always save to local storage first
            await chrome.storage.local.set({ [STORAGE_KEYS.FOLDERS]: folders });

            // Also try to sync if data is small enough
            const foldersSize = new Blob([JSON.stringify(folders)]).size;
            if (foldersSize <= 80000) {
                try {
                    await chrome.storage.sync.set({ [STORAGE_KEYS.FOLDERS]: folders });
                } catch (syncError) {
                    console.warn('Folder sync storage failed, but local storage succeeded:', syncError);
                }
            }
        } catch (error) {
            console.error('Failed to save clipboard folders:', error);
            throw error;
        }
    },

    // Settings
    async getSettings(): Promise<Partial<AppSettings>> {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
                const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
                return result[STORAGE_KEYS.SETTINGS] || {};
            }

            const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}';
            return JSON.parse(stored);
        } catch (error) {
            console.error('Failed to get settings:', error);
            return {};
        }
    },

    async saveSettings(settings: Partial<AppSettings>): Promise<void> {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
                await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
            } else {
                localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            throw error;
        }
    },

    // Get default settings
    getDefaultSettings(): AppSettings {
        return {
            theme: 'system',
            autoCapture: false,
            maxItems: 1000,
            shortcuts: {
                pasteFavorite: 'Alt+Shift+V',
                openPopup: 'Alt+Shift+P'
            },
            notifications: true,
            syncEnabled: true
        };
    },

    // History - for paste events tracking
    async getHistory(): Promise<PasteEvent[]> {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
                return result[STORAGE_KEYS.HISTORY] || [];
            }

            const stored = localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]';
            return JSON.parse(stored);
        } catch (error) {
            console.error('Failed to get history:', error);
            return [];
        }
    },

    async saveHistory(history: PasteEvent[]): Promise<void> {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history });
            } else {
                localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
            }
        } catch (error) {
            console.error('Failed to save history:', error);
            throw error;
        }
    },

    async addToHistory(event: Omit<PasteEvent, 'id' | 'timestamp'>): Promise<void> {
        try {
            const history = await this.getHistory();
            const newEvent: PasteEvent = {
                ...event,
                id: crypto.randomUUID(),
                timestamp: Date.now()
            };

            history.unshift(newEvent);
            // Keep only last 100 events
            await this.saveHistory(history.slice(0, 100));
        } catch (error) {
            console.error('Failed to add to history:', error);
        }
    },

    // Clear all data
    async clearAllData(): Promise<void> {
        try {
            if (typeof chrome !== 'undefined') {
                await Promise.all([
                    chrome.storage.local.clear(),
                    chrome.storage.sync.clear()
                ]);
            } else {
                Object.values(STORAGE_KEYS).forEach(key => {
                    localStorage.removeItem(key);
                });
            }
        } catch (error) {
            console.error('Failed to clear all data:', error);
            throw error;
        }
    },

    // Export all data for backup
    async exportData(): Promise<string> {
        try {
            const [items, folders, settings, history] = await Promise.all([
                this.getClipboardItems(),
                this.getClipboardFolders(),
                this.getSettings(),
                this.getHistory()
            ]);

            return JSON.stringify({
                version: '3.0',
                timestamp: Date.now(),
                items,
                folders,
                settings,
                history
            }, null, 2);
        } catch (error) {
            console.error('Failed to export data:', error);
            throw error;
        }
    },

    // Import data from backup
    async importData(jsonData: string): Promise<boolean> {
        try {
            const data = JSON.parse(jsonData);

            // Validate data structure
            if (!data.version || !data.items || !data.folders) {
                throw new Error('Invalid backup data format');
            }

            // Import data
            if (Array.isArray(data.items)) {
                await this.saveClipboardItems(data.items);
            }

            if (Array.isArray(data.folders)) {
                await this.saveClipboardFolders(data.folders);
            }

            if (data.settings && typeof data.settings === 'object') {
                await this.saveSettings(data.settings);
            }

            if (Array.isArray(data.history)) {
                await this.saveHistory(data.history);
            }

            console.log('Data imported successfully');
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    },

    // Storage usage information
    async getStorageUsage(): Promise<{
        items: { used: number; quota: number; percentage: number };
        sync: { used: number; quota: number; percentage: number };
    }> {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const [localUsage, syncUsage] = await Promise.all([
                    chrome.storage.local.getBytesInUse(),
                    chrome.storage.sync.getBytesInUse()
                ]);

                return {
                    items: {
                        used: localUsage,
                        quota: chrome.storage.local.QUOTA_BYTES,
                        percentage: (localUsage / chrome.storage.local.QUOTA_BYTES) * 100
                    },
                    sync: {
                        used: syncUsage,
                        quota: chrome.storage.sync.QUOTA_BYTES,
                        percentage: (syncUsage / chrome.storage.sync.QUOTA_BYTES) * 100
                    }
                };
            }

            // Fallback for non-extension environments
            const items = await this.getClipboardItems();
            const folders = await this.getClipboardFolders();
            const estimatedSize = new Blob([JSON.stringify({ items, folders })]).size;

            return {
                items: {
                    used: estimatedSize,
                    quota: 100 * 1024 * 1024, // 100MB estimate
                    percentage: (estimatedSize / (100 * 1024 * 1024)) * 100
                },
                sync: {
                    used: 0,
                    quota: 0,
                    percentage: 0
                }
            };
        } catch (error) {
            console.error('Failed to get storage usage:', error);
            return {
                items: { used: 0, quota: 0, percentage: 0 },
                sync: { used: 0, quota: 0, percentage: 0 }
            };
        }
    }
};

// Export types for use elsewhere
export type { AppSettings, PasteEvent };