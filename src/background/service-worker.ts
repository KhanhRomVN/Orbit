// Firefox Background Script - Compatible with both Chrome and Firefox APIs
// FIXED VERSION - Resolves TypeScript type errors

// Type declarations for Firefox browser API (must be at global scope)
declare const browser: typeof chrome;

(function () {
    'use strict';

    // Firefox/Chrome API compatibility layer
    const browserAPI = (function () {
        if (typeof (globalThis as any).browser !== 'undefined') {
            return (globalThis as any).browser; // Firefox
        } else if (typeof (globalThis as any).chrome !== 'undefined') {
            return (globalThis as any).chrome; // Chrome
        }
        throw new Error('No browser API available');
    })();

    // Enhanced logger functionality
    class Logger {
        private logs: any[] = [];
        private maxLogs = 1000;

        log(level: string, message: string, context?: any, source?: string) {
            const logEntry = {
                id: this.generateId(),
                timestamp: Date.now(),
                level,
                message,
                context,
                source: source || 'background-script'
            };

            this.logs.unshift(logEntry);
            if (this.logs.length > this.maxLogs) {
                this.logs.pop();
            }

            // Log to console with proper formatting
            const consoleMethod = (console as any)[level] || console.log;
            const timestamp = new Date().toISOString().substr(11, 8);
            consoleMethod(
                `%c[${timestamp}] [${source || 'bg'}] ${message}`,
                `color: ${this.getLogColor(level)}; font-weight: bold;`,
                context || ''
            );
        }

        private getLogColor(level: string): string {
            switch (level) {
                case 'error': return '#ff4444';
                case 'warn': return '#ffaa00';
                case 'info': return '#00aa00';
                case 'debug': return '#0088cc';
                default: return '#666666';
            }
        }

        private generateId(): string {
            return Math.random().toString(36).substr(2, 9);
        }

        info(message: string, context?: any, source?: string) {
            this.log('info', message, context, source);
        }

        warn(message: string, context?: any, source?: string) {
            this.log('warn', message, context, source);
        }

        error(message: string, context?: any, source?: string) {
            this.log('error', message, context, source);
        }

        debug(message: string, context?: any, source?: string) {
            this.log('debug', message, context, source);
        }

        getLogs() {
            return this.logs;
        }

        clearLogs() {
            this.logs = [];
        }
    }

    // Initialize logger
    const logger = new Logger();

    // Enhanced Firefox-compatible storage
    class BackgroundClipboardStorage {
        private readonly STORAGE_KEYS = {
            ITEMS: 'clipboard_items_v3',
            FOLDERS: 'clipboard_folders_v3'
        };

        async getClipboardItems(): Promise<any[]> {
            try {
                const storage = browserAPI.storage.local;
                const result = await storage.get(this.STORAGE_KEYS.ITEMS);

                if (result[this.STORAGE_KEYS.ITEMS]) {
                    logger.debug('Found clipboard items in local storage', {
                        count: result[this.STORAGE_KEYS.ITEMS].length
                    });
                    return result[this.STORAGE_KEYS.ITEMS];
                }

                // Try sync storage as fallback (if available)
                if (browserAPI.storage.sync) {
                    const syncResult = await browserAPI.storage.sync.get(this.STORAGE_KEYS.ITEMS);
                    if (syncResult[this.STORAGE_KEYS.ITEMS]) {
                        logger.debug('Found items in sync storage, migrating to local', {
                            count: syncResult[this.STORAGE_KEYS.ITEMS].length
                        });
                        await storage.set({ [this.STORAGE_KEYS.ITEMS]: syncResult[this.STORAGE_KEYS.ITEMS] });
                        return syncResult[this.STORAGE_KEYS.ITEMS];
                    }
                }

                logger.debug('No clipboard items found in any storage');
                return [];
            } catch (error) {
                logger.error('Failed to get clipboard items:', error);
                return [];
            }
        }

        async saveClipboardItems(items: any[]): Promise<void> {
            try {
                const storage = browserAPI.storage.local;
                await storage.set({ [this.STORAGE_KEYS.ITEMS]: items });
                logger.debug(`Saved ${items.length} clipboard items to local storage`);

                // Also try to sync if available and data is small enough
                if (browserAPI.storage.sync) {
                    const itemsSize = new Blob([JSON.stringify(items)]).size;
                    if (itemsSize <= 80000) {
                        try {
                            await browserAPI.storage.sync.set({ [this.STORAGE_KEYS.ITEMS]: items });
                            logger.debug('Also synced to sync storage');
                        } catch (syncError) {
                            logger.warn('Sync storage failed, but local storage succeeded:', syncError);
                        }
                    } else {
                        logger.debug('Data too large for sync storage, using local only', {
                            size: itemsSize,
                            limit: 80000
                        });
                    }
                }
            } catch (error) {
                logger.error('Failed to save clipboard items:', error);
                throw error;
            }
        }
    }

    const clipboardStorage = new BackgroundClipboardStorage();

    // Enhanced Content Script Manager for Firefox
    class ContentScriptManager {
        static async injectContentScript(tabId: number): Promise<void> {
            try {
                const isInjected = await this.isContentScriptInjected(tabId);
                if (isInjected) {
                    logger.debug(`Content script already injected in tab ${tabId}`);
                    return;
                }

                logger.info(`Injecting content script into tab ${tabId}`);

                // Firefox Manifest V2 uses tabs.executeScript
                if (typeof (globalThis as any).browser !== 'undefined') {
                    // Firefox API
                    await browserAPI.tabs.executeScript(tabId, {
                        file: 'content-main.js'
                    });
                } else if (browserAPI.scripting && browserAPI.scripting.executeScript) {
                    // Chrome Manifest V3 API
                    await browserAPI.scripting.executeScript({
                        target: { tabId },
                        files: ['content-main.js']
                    });
                } else {
                    // Chrome Manifest V2 fallback
                    await browserAPI.tabs.executeScript(tabId, {
                        file: 'content-main.js'
                    });
                }

                // Wait for script to initialize
                await new Promise(resolve => setTimeout(resolve, 200));
                logger.info(`Content script injected successfully in tab ${tabId}`);

            } catch (error) {
                logger.error('Failed to inject content script:', {
                    tabId,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
                throw error;
            }
        }

        static async sendMessageToTab(tabId: number, message: any, retries = 3): Promise<any> {
            for (let i = 0; i < retries; i++) {
                try {
                    logger.debug(`Sending message to tab ${tabId} (attempt ${i + 1}/${retries})`, {
                        action: message.action,
                        hasContent: !!message.content
                    });

                    // Ensure content script is injected
                    await this.injectContentScript(tabId);

                    // Transform message for direct paste
                    const finalMessage = {
                        ...message,
                        action: message.action === 'pasteClipboardItem' ? 'pasteDirectValue' : message.action
                    };

                    // Send message with timeout
                    const response = await Promise.race([
                        browserAPI.tabs.sendMessage(tabId, finalMessage),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Message timeout')), 5000)
                        )
                    ]);

                    if (response && response.success) {
                        logger.info(`Message sent successfully to tab ${tabId}`, {
                            action: finalMessage.action,
                            itemId: finalMessage.itemId
                        });
                        return response;
                    } else {
                        logger.warn(`Message failed in tab ${tabId}`, {
                            response,
                            attempt: i + 1
                        });
                    }
                } catch (error) {
                    logger.error(`Failed to send message to tab ${tabId} (attempt ${i + 1}):`, {
                        error: error instanceof Error ? error.message : String(error),
                        tabId
                    });

                    if (i === retries - 1) {
                        throw error;
                    }

                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
                }
            }

            throw new Error(`Failed to send message after ${retries} attempts`);
        }

        static async getActiveTab(): Promise<any> {
            try {
                const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
                const tab = tabs[0];

                if (!tab) {
                    logger.warn('No active tab found');
                    return null;
                }

                logger.debug('Active tab retrieved:', {
                    id: tab.id,
                    url: tab.url?.substring(0, 100) + '...',
                    title: tab.title?.substring(0, 50) + '...'
                });

                return tab;
            } catch (error) {
                logger.error('Failed to get active tab:', error);
                return null;
            }
        }

        static async isContentScriptInjected(tabId: number): Promise<boolean> {
            try {
                const response = await Promise.race([
                    browserAPI.tabs.sendMessage(tabId, { action: 'ping' }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Ping timeout')), 1000)
                    )
                ]);

                const isInjected = response && (response as any).success === true;
                logger.debug(`Content script injection check for tab ${tabId}: ${isInjected ? 'INJECTED' : 'NOT_INJECTED'}`);
                return isInjected;
            } catch (error) {
                logger.debug(`Content script not detected in tab ${tabId}:`,
                    error instanceof Error ? error.message : String(error)
                );
                return false;
            }
        }

        static isTabSupported(tab: any): boolean {
            if (!tab || !tab.url) {
                logger.warn('Tab or URL is undefined', { tab });
                return false;
            }

            const unsupportedUrls = [
                'chrome://',
                'chrome-extension://',
                'moz-extension://',
                'about:',
                'edge://',
                'safari-extension://',
                'resource://',
                'chrome-search://',
                'file://',
                'data:'
            ];

            const isSupported = !unsupportedUrls.some(prefix => tab.url.startsWith(prefix));

            if (!isSupported) {
                logger.warn(`Tab URL not supported: ${tab.url.substring(0, 100)}...`);
            }

            return isSupported;
        }
    }

    // Debug helper functions
    const debugHelper = {
        logToConsole: (message: string, data: any = null) => {
            logger.info(`[Debug] ${message}`, data);
        },

        testStorage: async () => {
            try {
                const items = await clipboardStorage.getClipboardItems();
                logger.info('[Storage Test] Items retrieved:', {
                    count: items.length,
                    favorites: items.filter((item: any) => item?.isFavorite).length
                });
                return items;
            } catch (error) {
                logger.error('[Storage Test] Error:', error);
                return null;
            }
        },

        testCommands: async () => {
            try {
                if (browserAPI.commands) {
                    const commands = await browserAPI.commands.getAll();
                    logger.info('[Commands Test] Registered:', commands);
                    return commands;
                } else {
                    logger.warn('[Commands Test] Commands API not available');
                    return [];
                }
            } catch (error) {
                logger.error('[Commands Test] Error:', error);
                return null;
            }
        },

        testActiveTab: async () => {
            try {
                const tab = await ContentScriptManager.getActiveTab();
                logger.info('[Tab Test] Active tab:', tab ? {
                    id: tab.id,
                    url: tab.url?.substring(0, 100) + '...',
                    supported: ContentScriptManager.isTabSupported(tab)
                } : 'No active tab');
                return tab;
            } catch (error) {
                logger.error('[Tab Test] Error:', error);
                return null;
            }
        }
    };

    // Make debug helper available globally
    (globalThis as any).debugHelper = debugHelper;

    // Startup logs
    console.log('🚀 ShortcutPaste Background Script loaded and running');
    logger.info('Background Script initialized', {
        browser: typeof (globalThis as any).browser !== 'undefined' ? 'Firefox' : 'Chrome',
        manifestVersion: browserAPI.runtime.getManifest().manifest_version,
        version: browserAPI.runtime.getManifest().version
    });

    // Check commands availability
    if (browserAPI.commands) {
        logger.info('🎹 Commands API is available');

        browserAPI.commands.getAll().then((commands: any[]) => {
            logger.info('🔧 Registered commands on startup:', {
                count: commands.length,
                commands: commands.map(cmd => ({
                    name: cmd.name,
                    shortcut: cmd.shortcut || 'No shortcut assigned',
                    description: cmd.description || 'No description'
                }))
            });

            if (commands.length === 0) {
                logger.warn('⚠️ No commands found! Extension may need to be reinstalled.');
            }
        }).catch((error: any) => {
            logger.error('❌ Failed to get commands:', error);
        });
    } else {
        logger.error('❌ Commands API is not available!');
    }

    // Enhanced command handling for keyboard shortcuts
    if (browserAPI.commands) {
        browserAPI.commands.onCommand.addListener(async (command: string, tab?: any) => {
            logger.info(`🎹 Keyboard command received: "${command}"`, {
                tabId: tab?.id,
                tabUrl: tab?.url?.substring(0, 100) + '...',
                tabTitle: tab?.title?.substring(0, 50) + '...'
            });

            try {
                if (command === 'paste_favorite_clipboard') {
                    await handlePasteFavoriteCommand(tab);
                } else {
                    logger.warn(`❓ Unknown command: "${command}"`);
                }
            } catch (error) {
                logger.error('💥 Error handling command:', {
                    command,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
        });
    }

    // Enhanced favorite paste handler
    async function handlePasteFavoriteCommand(tab?: any) {
        const startTime = Date.now();
        logger.info('📋 Processing paste_favorite_clipboard command...');

        try {
            // Get clipboard items
            const clipboardItems = await clipboardStorage.getClipboardItems();
            logger.info(`📦 Retrieved ${clipboardItems.length} clipboard items`);

            if (!Array.isArray(clipboardItems) || clipboardItems.length === 0) {
                logger.warn('⚠️ No clipboard items found');
                return { success: false, reason: 'no_items' };
            }

            // Log all items for debugging
            clipboardItems.forEach((item, index) => {
                logger.debug(`Item ${index}:`, {
                    id: item?.id,
                    title: item?.title?.substring(0, 30) + '...',
                    isFavorite: item?.isFavorite,
                    type: item?.type,
                    hasContent: !!item?.content,
                    contentLength: item?.content?.length || 0
                });
            });

            // Find favorite item
            const favoriteItem = clipboardItems.find(item =>
                item && typeof item === 'object' && item.isFavorite === true
            );

            if (!favoriteItem) {
                logger.warn('⚠️ No favorite clipboard item found', {
                    totalItems: clipboardItems.length,
                    availableItems: clipboardItems.map(item => ({
                        id: item?.id,
                        title: item?.title,
                        isFavorite: item?.isFavorite
                    }))
                });
                return { success: false, reason: 'no_favorite' };
            }

            logger.info('⭐ Found favorite item:', {
                id: favoriteItem.id,
                title: favoriteItem.title?.substring(0, 50) + '...',
                type: favoriteItem.type,
                contentLength: favoriteItem.content?.length || 0
            });

            // Validate content
            if (!favoriteItem.content || typeof favoriteItem.content !== 'string') {
                logger.error('❌ Favorite item has invalid content', {
                    hasContent: !!favoriteItem.content,
                    contentType: typeof favoriteItem.content,
                    item: favoriteItem
                });
                return { success: false, reason: 'invalid_content' };
            }

            // Get active tab
            let activeTab = tab;
            if (!activeTab) {
                activeTab = await ContentScriptManager.getActiveTab();
                if (!activeTab) {
                    logger.error('❌ No active tab found');
                    return { success: false, reason: 'no_active_tab' };
                }
            }

            if (!activeTab.id) {
                logger.error('❌ Active tab has no ID', { tab: activeTab });
                return { success: false, reason: 'invalid_tab' };
            }

            // Check tab support
            if (!ContentScriptManager.isTabSupported(activeTab)) {
                logger.warn('⚠️ Cannot inject into system page:', {
                    url: activeTab.url,
                    title: activeTab.title
                });
                return { success: false, reason: 'unsupported_tab' };
            }

            // Attempt paste
            logger.info(`📝 Attempting to paste content (${favoriteItem.content.length} chars) to tab ${activeTab.id}`);

            const response = await ContentScriptManager.sendMessageToTab(activeTab.id, {
                action: 'pasteDirectValue',
                content: favoriteItem.content,
                contentType: favoriteItem.type || 'text',
                itemId: favoriteItem.id
            });

            const duration = Date.now() - startTime;

            if (response?.success) {
                logger.info(`✅ Direct paste successful in ${duration}ms!`, {
                    itemId: favoriteItem.id,
                    tabId: activeTab.id,
                    verification: response.verification
                });
                return { success: true, duration, itemId: favoriteItem.id };
            } else {
                logger.error(`❌ Direct paste failed in ${duration}ms:`, response);
                return { success: false, reason: 'paste_failed', response, duration };
            }

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`💥 Critical error in handlePasteFavoriteCommand (${duration}ms):`, {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            return {
                success: false,
                reason: 'critical_error',
                error: error instanceof Error ? error.message : String(error),
                duration
            };
        }
    }

    // Define proper response type interfaces
    interface BaseResponse {
        success: boolean;
        messageId: string;
        error?: string;
    }

    interface TestCommandResponse extends BaseResponse {
        result?: any;
    }

    interface DebugStorageResponse extends BaseResponse {
        items?: any[];
        debugInfo?: any;
    }

    interface GetLogsResponse extends BaseResponse {
        logs?: any[];
    }

    // Enhanced message handling
    browserAPI.runtime.onMessage.addListener((request: any, sender: any, sendResponse: (response: any) => void) => {
        const messageId = Math.random().toString(36).substr(2, 8);
        logger.info(`📨 Runtime message received [${messageId}]:`, {
            action: request.action,
            sender: sender.tab ? `tab-${sender.tab.id}` : 'popup',
            hasData: !!request.data
        });

        // Handle async responses properly
        const handleAsync = async () => {
            try {
                switch (request.action) {
                    case "testCommand":
                        logger.info('🧪 Manual command test triggered');
                        const result = await handlePasteFavoriteCommand();
                        const testResponse: TestCommandResponse = {
                            success: result.success,
                            result,
                            messageId
                        };
                        sendResponse(testResponse);
                        break;

                    case "debugStorage":
                        const items = await clipboardStorage.getClipboardItems();
                        const debugInfo = {
                            count: items.length,
                            favorites: items.filter(item => item?.isFavorite).length,
                            items: items.map(item => ({
                                id: item?.id,
                                title: item?.title,
                                isFavorite: item?.isFavorite,
                                type: item?.type
                            }))
                        };
                        logger.info('🔍 Storage debug requested:', debugInfo);
                        const debugResponse: DebugStorageResponse = {
                            success: true,
                            items,
                            debugInfo,
                            messageId
                        };
                        sendResponse(debugResponse);
                        break;

                    case "getLogs":
                        const logsResponse: GetLogsResponse = {
                            success: true,
                            logs: logger.getLogs(),
                            messageId
                        };
                        sendResponse(logsResponse);
                        break;

                    case "clearLogs":
                        logger.clearLogs();
                        const clearResponse: BaseResponse = { success: true, messageId };
                        sendResponse(clearResponse);
                        break;

                    default:
                        logger.warn(`❓ Unknown message action: "${request.action}"`);
                        const errorResponse: BaseResponse = {
                            success: false,
                            error: `Unknown action: ${request.action}`,
                            messageId
                        };
                        sendResponse(errorResponse);
                }

            } catch (error) {
                logger.error(`💥 Error handling message [${messageId}]:`, error);
                const errorResponse: BaseResponse = {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    messageId
                };
                sendResponse(errorResponse);
            }
        };

        handleAsync();
        return true; // Keep message channel open for async response
    });

    // Enhanced error handling
    const handleError = (event: ErrorEvent) => {
        logger.error('💥 ShortcutPaste background script error:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error?.stack
        });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
        logger.error('💥 ShortcutPaste background script unhandled rejection:', {
            reason: event.reason,
            promise: event.promise
        });
    };

    if (typeof self !== 'undefined') {
        self.addEventListener('error', handleError);
        self.addEventListener('unhandledrejection', handleRejection);
    }

    // Periodic health checks
    let healthCheckInterval: ReturnType<typeof setInterval>;

    const performHealthCheck = async () => {
        try {
            const [commands, items] = await Promise.all([
                browserAPI.commands ? browserAPI.commands.getAll() : [],
                clipboardStorage.getClipboardItems()
            ]);

            const health = {
                commands: commands.length,
                items: items.length,
                favorites: items.filter((item: any) => item?.isFavorite).length,
                timestamp: Date.now()
            };

            // Only log if there are issues
            if (commands.length === 0) {
                logger.warn('⚠️ Health check: No commands registered');
            }

            // Store health info for debugging
            (globalThis as any).lastHealthCheck = health;

        } catch (error) {
            logger.error('❌ Health check failed:', error);
        }
    };

    // Start health checks after 10 seconds, then every 5 minutes
    setTimeout(() => {
        performHealthCheck();
        healthCheckInterval = setInterval(performHealthCheck, 300000);
    }, 10000);

    // Run initial debug tests
    setTimeout(() => {
        logger.info('🔧 Running initial debug tests...');
        debugHelper.testStorage();
        debugHelper.testCommands();
        logger.info('✅ Background script fully initialized');
    }, 1000);

    // Cleanup on unload
    if (typeof self !== 'undefined') {
        self.addEventListener('beforeunload', () => {
            if (healthCheckInterval) {
                clearInterval(healthCheckInterval);
            }
            logger.info('🛑 Background script unloading');
        });
    }

})();