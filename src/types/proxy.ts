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
  purchaseDate?: string;
  duration?: number;
  expiryDate?: string;
  isActive: boolean;
  createdAt: number;
}

export interface ProxyAssignment {
  groupId?: string;
  tabId?: number;
  containerIds?: string[]; // THAY ĐỔI: 1 proxy có thể gán cho nhiều container
  proxyId: string;
}

export interface TabGroupWithProxy {
  proxyId?: string;
  hasTabProxies?: boolean;
}

export interface ExtendedTabWithProxy {
  proxyId?: string;
  isSleeping?: boolean;
}
