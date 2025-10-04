// File: src/types/tab-group.ts
export interface BrowserContainer {
  cookieStoreId: string;
  name: string;
  icon: string;
  color: string;
}

export interface ExtendedTab extends Omit<chrome.tabs.Tab, "groupId"> {
  cookieStoreId?: string;
  groupId?: string;
}

export interface TabGroup {
  id: string;
  name: string;
  type: "custom" | "container";
  color: string;
  icon: string;
  tabs: ExtendedTab[];
  visible: boolean;
  containerId?: string; // For container groups
  lastActiveTabId?: number; // Track last focused tab in this group
  createdAt: number;
}

export interface GroupModalState {
  isOpen: boolean;
  mode: "create" | "edit";
  group?: TabGroup;
}
