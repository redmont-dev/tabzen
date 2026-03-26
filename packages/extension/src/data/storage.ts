function createStorageWrapper(area: chrome.storage.SyncStorageArea | chrome.storage.LocalStorageArea) {
  return {
    async get<T>(key: string, defaultValue: T): Promise<T> {
      try {
        const result = await area.get({ [key]: defaultValue });
        return result[key] as T;
      } catch (err) {
        console.warn(`Storage get("${key}") failed:`, err);
        return defaultValue;
      }
    },
    async set<T>(key: string, value: T): Promise<void> {
      try {
        await area.set({ [key]: value });
      } catch (err) {
        console.warn(`Storage set("${key}") failed:`, err);
      }
    },
    async remove(key: string): Promise<void> {
      try {
        await area.remove(key);
      } catch (err) {
        console.warn(`Storage remove("${key}") failed:`, err);
      }
    },
    async clear(): Promise<void> {
      try {
        await area.clear();
      } catch (err) {
        console.warn('Storage clear() failed:', err);
      }
    },
  };
}

export const SyncStorage = createStorageWrapper(chrome.storage.sync);
export const LocalStorage = createStorageWrapper(chrome.storage.local);
