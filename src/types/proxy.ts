// File: src/types/proxy.ts
export type ProxyType = "http" | "https" | "socks5";

export interface ProxyConfig {
  id: string;
  name: string;
  type: ProxyType;
  address: string;
  port: number;
  username?: string;
  password?: string;
  purchaseDate?: string; // ISO date string
  duration?: number; // Duration in days
  expiryDate?: string; // ISO date string (auto-calculated)
  isActive: boolean;
  lastTested?: string; // ISO date string
  testStatus?: "success" | "failed" | "pending";
  createdAt: number;
}

export interface ProxyAssignment {
  groupId?: string; // If assigned to a group
  tabId?: number; // If assigned to a specific tab
  proxyId: string;
}

// Extend TabGroup to include proxy assignment
export interface TabGroupWithProxy {
  proxyId?: string;
  hasTabProxies?: boolean; // Flag to indicate if any tabs have individual proxies
}

// Extend ExtendedTab to include proxy assignment
export interface ExtendedTabWithProxy {
  proxyId?: string;
  isSleeping?: boolean;
}
