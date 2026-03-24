import type { Session, AnalyticsSnapshot } from './types';
import { INDEXEDDB_NAME, INDEXEDDB_VERSION } from '@/shared/constants';

export class TabzenDB {
  private db: IDBDatabase | null = null;
  private dbName: string;

  constructor(name: string = INDEXEDDB_NAME) {
    this.dbName = name;
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, INDEXEDDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('analytics')) {
          const store = db.createObjectStore('analytics', { keyPath: 'timestamp' });
          store.createIndex('timestamp', 'timestamp');
        }
      };
      request.onsuccess = () => { this.db = request.result; resolve(); };
      request.onerror = () => reject(request.error);
    });
  }

  private getStore(name: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not open');
    return this.db.transaction(name, mode).objectStore(name);
  }

  private request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async putSession(session: Session): Promise<void> {
    await this.request(this.getStore('sessions', 'readwrite').put(session));
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.request(this.getStore('sessions').get(id));
  }

  async getAllSessions(): Promise<Session[]> {
    return this.request(this.getStore('sessions').getAll());
  }

  async deleteSession(id: string): Promise<void> {
    await this.request(this.getStore('sessions', 'readwrite').delete(id));
  }

  async putAnalytics(snapshot: AnalyticsSnapshot): Promise<void> {
    await this.request(this.getStore('analytics', 'readwrite').put(snapshot));
  }

  async getAnalytics(from: number, to: number): Promise<AnalyticsSnapshot[]> {
    const range = IDBKeyRange.bound(from, to);
    return this.request(this.getStore('analytics').getAll(range));
  }

  async pruneAnalytics(cutoff: number): Promise<void> {
    const store = this.getStore('analytics', 'readwrite');
    const range = IDBKeyRange.upperBound(cutoff, true);
    const request = store.index('timestamp').openCursor(range);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
        else { resolve(); }
      };
      request.onerror = () => reject(request.error);
    });
  }
}
