// types/browser.d.ts
// Global type declarations for Firefox browser API

declare const browser: typeof chrome;

// Alternative: if you want more specific typing
interface BrowserAPI {
    storage: {
        local: chrome.storage.LocalStorageArea;
        sync?: chrome.storage.SyncStorageArea;
    };
    tabs: typeof chrome.tabs;
    runtime: typeof chrome.runtime;
    scripting?: typeof chrome.scripting;
    commands?: typeof chrome.commands;
}

declare const browser: BrowserAPI;