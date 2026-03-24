import { vi } from 'vitest';

const storageSyncData: Record<string, unknown> = {};
const storageLocalData: Record<string, unknown> = {};

const createStorageArea = (data: Record<string, unknown>) => ({
  get: vi.fn(async (keys?: string | string[] | Record<string, unknown>) => {
    if (!keys) return { ...data };
    if (typeof keys === 'string') return { [keys]: data[keys] };
    if (Array.isArray(keys)) {
      const result: Record<string, unknown> = {};
      for (const k of keys) result[k] = data[k];
      return result;
    }
    const result: Record<string, unknown> = {};
    for (const [k, defaultVal] of Object.entries(keys)) {
      result[k] = data[k] ?? defaultVal;
    }
    return result;
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(data, items);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    const keyArr = Array.isArray(keys) ? keys : [keys];
    for (const k of keyArr) delete data[k];
  }),
  clear: vi.fn(async () => {
    for (const k of Object.keys(data)) delete data[k];
  }),
});

const chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    connect: vi.fn(() => ({
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
      postMessage: vi.fn(),
      disconnect: vi.fn(),
    })),
    onConnect: { addListener: vi.fn(), removeListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    id: 'mock-extension-id',
  },
  storage: {
    sync: createStorageArea(storageSyncData),
    local: createStorageArea(storageLocalData),
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: {
    query: vi.fn(async () => []),
    get: vi.fn(async () => ({})),
    create: vi.fn(async () => ({ id: 1 })),
    update: vi.fn(async () => ({})),
    remove: vi.fn(async () => {}),
    move: vi.fn(async () => ({})),
    group: vi.fn(async () => 1),
    ungroup: vi.fn(async () => {}),
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabGroups: {
    query: vi.fn(async () => []),
    get: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    TAB_GROUP_ID_NONE: -1,
  },
  windows: {
    getCurrent: vi.fn(async () => ({ id: 1 })),
    create: vi.fn(async () => ({ id: 2 })),
    getAll: vi.fn(async () => []),
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(async () => true),
    get: vi.fn(async () => null),
    onAlarm: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  notifications: {
    create: vi.fn(),
    clear: vi.fn(),
    onClicked: { addListener: vi.fn(), removeListener: vi.fn() },
    onButtonClicked: { addListener: vi.fn(), removeListener: vi.fn() },
    onClosed: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  contextMenus: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(async () => {}),
    onClicked: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  sidePanel: {
    setOptions: vi.fn(async () => {}),
    setPanelBehavior: vi.fn(async () => {}),
  },
  identity: {
    getAuthToken: vi.fn(async () => ({ token: 'mock-token' })),
    removeCachedAuthToken: vi.fn(async () => {}),
  },
  webNavigation: {
    onCreatedNavigationTarget: { addListener: vi.fn(), removeListener: vi.fn() },
  },
};

Object.assign(globalThis, { chrome });

export { storageSyncData, storageLocalData };
