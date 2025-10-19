interface SessionTab {
  title: string;
  url: string;
  favIconUrl: string | null;
  cookieStoreId?: string; // ← THAY: string -> string | undefined
  groupId: string;
}

interface SessionGroup {
  id: string;
  name: string;
  type: "custom" | "container";
  color: string;
  icon: string;
  visible: boolean;
  containerId?: string;
  lastActiveTabId?: number;
  createdAt: number;
  tabs: SessionTab[];
}

export interface SessionData {
  id: string;
  timestamp: number;
  groups: SessionGroup[];
  activeGroupId: string | null;
}

class IndexedDBService {
  private dbName = "OrbitSessionDB";
  private storeName = "sessions";
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "id" });
        }
      };
    });
  }

  async saveSession(
    timestamp: number,
    groups: SessionGroup[],
    activeGroupId: string | null
  ): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const data: SessionData = {
        id: "latest-session",
        timestamp,
        groups,
        activeGroupId,
      };

      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(): Promise<SessionData | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get("latest-session");

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async clearSession(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete("latest-session");

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexedDBService = new IndexedDBService();
