// File: src/shared/lib/proxy-manager.ts
import { ProxyConfig, ProxyAssignment } from "@/types/proxy";
import { getBrowserAPI } from "./browser-api";

export class ProxyManager {
  private static readonly PROXY_STORAGE_KEY = "sigil-proxies";
  private static readonly PROXY_ASSIGNMENT_KEY = "sigil-proxy-assignments";

  // Get all saved proxies
  static async getProxies(): Promise<ProxyConfig[]> {
    try {
      const browserAPI = getBrowserAPI();
      console.log(
        "[ProxyManager] Getting proxies with key:",
        this.PROXY_STORAGE_KEY
      );

      const result = await browserAPI.storage.local.get([
        this.PROXY_STORAGE_KEY,
      ]);

      if (!result || typeof result !== "object") {
        console.warn("[ProxyManager] Invalid storage result:", result);
        return [];
      }

      console.log("[ProxyManager] Storage result:", result);

      const proxies = result[this.PROXY_STORAGE_KEY];
      console.log("[ProxyManager] Proxies found:", proxies);

      return Array.isArray(proxies) ? proxies : [];
    } catch (error) {
      console.error("[ProxyManager] Failed to load proxies:", error);
      return [];
    }
  }

  // Save a proxy
  static async saveProxy(proxy: ProxyConfig): Promise<void> {
    const browserAPI = getBrowserAPI();
    const proxies = await this.getProxies();
    const existingIndex = proxies.findIndex((p) => p.id === proxy.id);

    if (existingIndex >= 0) {
      proxies[existingIndex] = proxy;
    } else {
      proxies.push(proxy);
    }

    console.log("[ProxyManager] Saving proxies to storage:", proxies);
    await browserAPI.storage.local.set({ [this.PROXY_STORAGE_KEY]: proxies });
    console.log("[ProxyManager] Proxies saved successfully");
  }

  // Delete a proxy
  static async deleteProxy(proxyId: string): Promise<void> {
    const browserAPI = getBrowserAPI();
    const proxies = await this.getProxies();
    const filtered = proxies.filter((p) => p.id !== proxyId);
    await browserAPI.storage.local.set({ [this.PROXY_STORAGE_KEY]: filtered });

    // Also remove any assignments using this proxy
    await this.removeProxyAssignments(proxyId);
  }

  // Get all proxy assignments
  static async getAssignments(): Promise<ProxyAssignment[]> {
    try {
      const browserAPI = getBrowserAPI();
      console.log(
        "[ProxyManager] Getting assignments with key:",
        this.PROXY_ASSIGNMENT_KEY
      );

      const result = await browserAPI.storage.local.get([
        this.PROXY_ASSIGNMENT_KEY,
      ]);

      if (!result || typeof result !== "object") {
        console.warn("[ProxyManager] Invalid storage result:", result);
        return [];
      }

      console.log("[ProxyManager] Storage result:", result);

      const assignments = result[this.PROXY_ASSIGNMENT_KEY];
      console.log("[ProxyManager] Assignments found:", assignments);

      return Array.isArray(assignments) ? assignments : [];
    } catch (error) {
      console.error("[ProxyManager] Failed to load proxy assignments:", error);
      return [];
    }
  }

  // Assign proxy to group
  static async assignProxyToGroup(
    groupId: string,
    proxyId: string
  ): Promise<void> {
    const browserAPI = getBrowserAPI();
    const assignments = await this.getAssignments();

    // Remove existing assignment for this group
    const filtered = assignments.filter((a) => a.groupId !== groupId);

    // Add new assignment
    filtered.push({ groupId, proxyId });

    await browserAPI.storage.local.set({
      [this.PROXY_ASSIGNMENT_KEY]: filtered,
    });
  }

  // Assign proxy to tab
  static async assignProxyToTab(tabId: number, proxyId: string): Promise<void> {
    const browserAPI = getBrowserAPI();
    const assignments = await this.getAssignments();

    // Remove existing assignment for this tab
    const filtered = assignments.filter((a) => a.tabId !== tabId);

    // Add new assignment
    filtered.push({ tabId, proxyId });

    await browserAPI.storage.local.set({
      [this.PROXY_ASSIGNMENT_KEY]: filtered,
    });
  }

  // Remove proxy assignment from group
  static async removeGroupProxy(groupId: string): Promise<void> {
    const browserAPI = getBrowserAPI();
    const assignments = await this.getAssignments();
    const filtered = assignments.filter((a) => a.groupId !== groupId);
    await browserAPI.storage.local.set({
      [this.PROXY_ASSIGNMENT_KEY]: filtered,
    });
  }

  // Remove proxy assignment from tab
  static async removeTabProxy(tabId: number): Promise<void> {
    const browserAPI = getBrowserAPI();
    const assignments = await this.getAssignments();
    const filtered = assignments.filter((a) => a.tabId !== tabId);
    await browserAPI.storage.local.set({
      [this.PROXY_ASSIGNMENT_KEY]: filtered,
    });
  }

  // Assign proxy to containers (many-to-many)
  static async assignProxyToContainers(
    containerIds: string[],
    proxyId: string
  ): Promise<void> {
    const browserAPI = getBrowserAPI();
    const assignments = await this.getAssignments();

    // Remove existing assignment for this proxy
    const filtered = assignments.filter((a) => a.proxyId !== proxyId);

    // Add new assignment with multiple containers
    if (containerIds.length > 0) {
      filtered.push({ containerIds, proxyId });
    }

    await browserAPI.storage.local.set({
      [this.PROXY_ASSIGNMENT_KEY]: filtered,
    });
  }

  // Add container to existing proxy assignment
  static async addContainerToProxy(
    containerId: string,
    proxyId: string
  ): Promise<void> {
    const browserAPI = getBrowserAPI();
    const assignments = await this.getAssignments();

    const assignment = assignments.find((a) => a.proxyId === proxyId);

    if (assignment && assignment.containerIds) {
      // Thêm container vào list nếu chưa có
      if (!assignment.containerIds.includes(containerId)) {
        assignment.containerIds.push(containerId);
      }
    } else {
      // Tạo assignment mới
      assignments.push({ containerIds: [containerId], proxyId });
    }

    await browserAPI.storage.local.set({
      [this.PROXY_ASSIGNMENT_KEY]: assignments,
    });
  }

  // Remove container from proxy assignment
  static async removeContainerFromProxy(
    containerId: string,
    proxyId: string
  ): Promise<void> {
    const browserAPI = getBrowserAPI();
    const assignments = await this.getAssignments();

    const assignment = assignments.find((a) => a.proxyId === proxyId);

    if (assignment && assignment.containerIds) {
      assignment.containerIds = assignment.containerIds.filter(
        (id) => id !== containerId
      );

      // Nếu không còn container nào, xóa assignment
      if (assignment.containerIds.length === 0) {
        const filtered = assignments.filter((a) => a.proxyId !== proxyId);
        await browserAPI.storage.local.set({
          [this.PROXY_ASSIGNMENT_KEY]: filtered,
        });
        return;
      }
    }

    await browserAPI.storage.local.set({
      [this.PROXY_ASSIGNMENT_KEY]: assignments,
    });
  }

  // Remove all containers from proxy
  static async removeAllContainersFromProxy(proxyId: string): Promise<void> {
    const browserAPI = getBrowserAPI();
    const assignments = await this.getAssignments();
    const filtered = assignments.filter((a) => a.proxyId !== proxyId);
    await browserAPI.storage.local.set({
      [this.PROXY_ASSIGNMENT_KEY]: filtered,
    });
  }

  // Get proxy for a specific container
  static async getContainerProxy(containerId: string): Promise<string | null> {
    const assignments = await this.getAssignments();
    const assignment = assignments.find(
      (a) => a.containerIds && a.containerIds.includes(containerId)
    );
    return assignment?.proxyId || null;
  }

  // Get all containers assigned to a proxy
  static async getProxyContainers(proxyId: string): Promise<string[]> {
    const assignments = await this.getAssignments();
    const assignment = assignments.find((a) => a.proxyId === proxyId);
    return assignment?.containerIds || [];
  }

  // Get proxy for a tab based on its container
  static async getProxyForTab(tab: {
    cookieStoreId?: string;
    id?: number;
  }): Promise<string | null> {
    const assignments = await this.getAssignments();

    // Priority 1: Tab-specific proxy
    if (tab.id) {
      const tabAssignment = assignments.find((a) => a.tabId === tab.id);
      if (tabAssignment) return tabAssignment.proxyId;
    }

    // Priority 2: Container proxy
    if (tab.cookieStoreId && tab.cookieStoreId !== "firefox-default") {
      const containerAssignment = assignments.find(
        (a) => a.containerIds && a.containerIds.includes(tab.cookieStoreId!)
      );
      if (containerAssignment) return containerAssignment.proxyId;
    }

    return null;
  }

  // Remove all assignments for a specific proxy
  static async removeProxyAssignments(proxyId: string): Promise<void> {
    const browserAPI = getBrowserAPI();
    const assignments = await this.getAssignments();
    const filtered = assignments.filter((a) => a.proxyId !== proxyId);
    await browserAPI.storage.local.set({
      [this.PROXY_ASSIGNMENT_KEY]: filtered,
    });
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
    _groupId: string,
    tabIds: number[]
  ): Promise<boolean> {
    const assignments = await this.getAssignments();
    return assignments.some((a) => a.tabId && tabIds.includes(a.tabId));
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
