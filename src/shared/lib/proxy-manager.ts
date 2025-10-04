// File: src/shared/lib/proxy-manager.ts
import { ProxyConfig, ProxyAssignment } from "@/types/proxy";

export class ProxyManager {
  private static readonly PROXY_STORAGE_KEY = "sigil-proxies";
  private static readonly PROXY_ASSIGNMENT_KEY = "sigil-proxy-assignments";

  // Get all saved proxies
  static async getProxies(): Promise<ProxyConfig[]> {
    try {
      const result = await chrome.storage.local.get([this.PROXY_STORAGE_KEY]);

      // ✅ FIX: chrome.storage.local.get() luôn trả về object, ngay cả khi rỗng
      // Không cần check typeof result
      if (!result) {
        console.warn(
          "[ProxyManager] Storage result is null/undefined:",
          result
        );
        return [];
      }

      return result[this.PROXY_STORAGE_KEY] || [];
    } catch (error) {
      console.error("Failed to load proxies:", error);
      return [];
    }
  }

  // Save a proxy
  static async saveProxy(proxy: ProxyConfig): Promise<void> {
    const proxies = await this.getProxies();
    const existingIndex = proxies.findIndex((p) => p.id === proxy.id);

    if (existingIndex >= 0) {
      proxies[existingIndex] = proxy;
    } else {
      proxies.push(proxy);
    }

    await chrome.storage.local.set({ [this.PROXY_STORAGE_KEY]: proxies });
  }

  // Delete a proxy
  static async deleteProxy(proxyId: string): Promise<void> {
    const proxies = await this.getProxies();
    const filtered = proxies.filter((p) => p.id !== proxyId);
    await chrome.storage.local.set({ [this.PROXY_STORAGE_KEY]: filtered });

    // Also remove any assignments using this proxy
    await this.removeProxyAssignments(proxyId);
  }

  // Get all proxy assignments
  static async getAssignments(): Promise<ProxyAssignment[]> {
    try {
      const result = await chrome.storage.local.get([
        this.PROXY_ASSIGNMENT_KEY,
      ]);

      // ✅ FIX: chrome.storage.local.get() luôn trả về object, ngay cả khi rỗng
      if (!result) {
        console.warn(
          "[ProxyManager] Storage result is null/undefined:",
          result
        );
        return [];
      }

      return result[this.PROXY_ASSIGNMENT_KEY] || [];
    } catch (error) {
      console.error("Failed to load proxy assignments:", error);
      return [];
    }
  }

  // Assign proxy to group
  static async assignProxyToGroup(
    groupId: string,
    proxyId: string
  ): Promise<void> {
    const assignments = await this.getAssignments();

    // Remove existing assignment for this group
    const filtered = assignments.filter((a) => a.groupId !== groupId);

    // Add new assignment
    filtered.push({ groupId, proxyId });

    await chrome.storage.local.set({ [this.PROXY_ASSIGNMENT_KEY]: filtered });
  }

  // Assign proxy to tab
  static async assignProxyToTab(tabId: number, proxyId: string): Promise<void> {
    const assignments = await this.getAssignments();

    // Remove existing assignment for this tab
    const filtered = assignments.filter((a) => a.tabId !== tabId);

    // Add new assignment
    filtered.push({ tabId, proxyId });

    await chrome.storage.local.set({ [this.PROXY_ASSIGNMENT_KEY]: filtered });
  }

  // Remove proxy assignment from group
  static async removeGroupProxy(groupId: string): Promise<void> {
    const assignments = await this.getAssignments();
    const filtered = assignments.filter((a) => a.groupId !== groupId);
    await chrome.storage.local.set({ [this.PROXY_ASSIGNMENT_KEY]: filtered });
  }

  // Remove proxy assignment from tab
  static async removeTabProxy(tabId: number): Promise<void> {
    const assignments = await this.getAssignments();
    const filtered = assignments.filter((a) => a.tabId !== tabId);
    await chrome.storage.local.set({ [this.PROXY_ASSIGNMENT_KEY]: filtered });
  }

  // Remove all assignments for a specific proxy
  static async removeProxyAssignments(proxyId: string): Promise<void> {
    const assignments = await this.getAssignments();
    const filtered = assignments.filter((a) => a.proxyId !== proxyId);
    await chrome.storage.local.set({ [this.PROXY_ASSIGNMENT_KEY]: filtered });
  }

  // Get proxy assignment for group
  static async getGroupProxy(groupId: string): Promise<string | null> {
    const assignments = await this.getAssignments();
    const assignment = assignments.find((a) => a.groupId === groupId);
    return assignment?.proxyId || null;
  }

  // Get proxy assignment for tab
  static async getTabProxy(tabId: number): Promise<string | null> {
    const assignments = await this.getAssignments();
    const assignment = assignments.find((a) => a.tabId === tabId);
    return assignment?.proxyId || null;
  }

  // Check if group has any tabs with individual proxies
  static async groupHasTabProxies(
    groupId: string,
    tabIds: number[]
  ): Promise<boolean> {
    const assignments = await this.getAssignments();
    return assignments.some((a) => a.tabId && tabIds.includes(a.tabId));
  }

  // Test proxy connection
  static async testProxyConnection(proxy: ProxyConfig): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "testProxy",
        proxy: proxy,
      });

      return response?.success || false;
    } catch (error) {
      console.error("Proxy test failed:", error);
      return false;
    }
  }

  // Calculate expiry date
  static calculateExpiryDate(purchaseDate: string, duration: number): string {
    const purchase = new Date(purchaseDate);
    const expiry = new Date(purchase);
    expiry.setDate(expiry.getDate() + duration);
    return expiry.toISOString();
  }

  // Parse quick input format (address:port:username:password)
  static parseQuickInput(input: string): Partial<ProxyConfig> | null {
    const parts = input.split(":");

    if (parts.length < 2) return null;

    const [address, portStr, username, password] = parts;
    const port = parseInt(portStr, 10);

    if (isNaN(port) || port < 1 || port > 65535) return null;

    return {
      address: address.trim(),
      port,
      username: username?.trim() || undefined,
      password: password?.trim() || undefined,
    };
  }
}
