function createStorageWrapper(area: chrome.storage.SyncStorageArea | chrome.storage.LocalStorageArea) {
  return {
    async get<T>(key: string, defaultValue: T): Promise<T> {
      const result = await area.get({ [key]: defaultValue });
      return result[key] as T;
    },
    async set<T>(key: string, value: T): Promise<void> {
      await area.set({ [key]: value });
    },
    async remove(key: string): Promise<void> {
      await area.remove(key);
    },
    async clear(): Promise<void> {
      await area.clear();
    },
  };
}

export const SyncStorage = createStorageWrapper(chrome.storage.sync);
export const LocalStorage = createStorageWrapper(chrome.storage.local);
