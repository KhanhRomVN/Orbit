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
  tabs: typeof chrome.tabs & {
    hide(tabIds: number[]): Promise<void>;
    show(tabIds: number[]): Promise<void>;
  };
}

declare const browser: typeof chrome & FirefoxBrowserAPI;
