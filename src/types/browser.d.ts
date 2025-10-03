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

interface ContextualIdentitiesAPI {
  query: (details: any) => Promise<BrowserContainer[]>;
}

interface ExtendedBrowserAPI {
  contextualIdentities?: ContextualIdentitiesAPI;
  tabs: {
    query: (queryInfo: any) => Promise<ExtendedTab[]>;
    sendMessage: typeof chrome.tabs.sendMessage;
    executeScript: typeof chrome.tabs.executeScript;
  };
  runtime: typeof chrome.runtime;
  scripting?: typeof chrome.scripting;
}

// Fix TypeScript issues with browser API
declare const browser: typeof chrome & ExtendedBrowserAPI;

// Extend Chrome namespace to include contextualIdentities
declare namespace chrome {
  namespace contextualIdentities {
    export function query(details: any): Promise<BrowserContainer[]>;
  }
}
