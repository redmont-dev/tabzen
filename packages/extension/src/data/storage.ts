function createStorageWrapper(area: chrome.storage.SyncStorageArea | chrome.storage.LocalStorageArea) {
  return {
    async get<T>(key: string, defaultValue: T): Promise<T> {
      try {
        const result = await area.get({ [key]: defaultValue });
        return result[key] as T;
      } catch (err) {
        console.error(`Storage get("${key}") failed:`, err);
        return defaultValue;
      }
    },
    async set<T>(key: string, value: T): Promise<void> {
      try {
        await area.set({ [key]: value });
      } catch (err) {
        console.error(`Storage set("${key}") failed:`, err);
        throw err;
      }
    },
    async remove(key: string): Promise<void> {
      try {
        await area.remove(key);
      } catch (err) {
        console.error(`Storage remove("${key}") failed:`, err);
        throw err;
      }
    },
    async clear(): Promise<void> {
      try {
        await area.clear();
      } catch (err) {
        console.error('Storage clear() failed:', err);
        throw err;
      }
    },
  };
}

export const SyncStorage = createStorageWrapper(chrome.storage.sync);
export const LocalStorage = createStorageWrapper(chrome.storage.local);
