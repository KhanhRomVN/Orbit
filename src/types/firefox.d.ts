// types/firefox.d.ts
interface BrowserContainer {
  cookieStoreId: string;
  name: string;
  icon: string;
  color: string;
}

interface FirefoxBrowserAPI {
  contextualIdentities?: {
    query: (details: any) => Promise<BrowserContainer[]>;
  };
  tabs?: {
    query: (queryInfo: any) => Promise<chrome.tabs.Tab[]>;
  };
}

declare const browser: typeof chrome & FirefoxBrowserAPI;
