// types/browser.d.ts
interface BrowserContainer {
  cookieStoreId: string;
  name: string;
  icon: string;
  color: string;
}

interface ExtendedTab extends chrome.tabs.Tab {
  cookieStoreId?: string;
}

interface ExtendedBrowserAPI {
  contextualIdentities?: {
    query: (details: any) => Promise<BrowserContainer[]>;
  };
  tabs: {
    query: (queryInfo: any) => Promise<ExtendedTab[]>;
    sendMessage: typeof chrome.tabs.sendMessage;
    executeScript: typeof chrome.tabs.executeScript;
  };
  runtime: typeof chrome.runtime;
  scripting?: typeof chrome.scripting;
}

declare const browser: typeof chrome & ExtendedBrowserAPI;
