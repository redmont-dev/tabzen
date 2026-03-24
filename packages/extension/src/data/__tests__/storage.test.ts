import { describe, it, expect, beforeEach } from 'vitest';
import { SyncStorage, LocalStorage } from '../storage';
import { storageSyncData, storageLocalData } from '../../../tests/setup';

describe('SyncStorage', () => {
  beforeEach(() => { for (const k of Object.keys(storageSyncData)) delete storageSyncData[k]; });

  it('gets a value with default', async () => {
    const result = await SyncStorage.get('settings', { theme: 'system' });
    expect(result).toEqual({ theme: 'system' });
  });

  it('sets and gets a value', async () => {
    await SyncStorage.set('settings', { theme: 'dark' });
    const result = await SyncStorage.get('settings', null);
    expect(result).toEqual({ theme: 'dark' });
  });

  it('removes a value', async () => {
    await SyncStorage.set('settings', { theme: 'dark' });
    await SyncStorage.remove('settings');
    const result = await SyncStorage.get('settings', 'default');
    expect(result).toBe('default');
  });
});

describe('LocalStorage', () => {
  beforeEach(() => { for (const k of Object.keys(storageLocalData)) delete storageLocalData[k]; });

  it('sets and gets a value', async () => {
    await LocalStorage.set('sessions', [{ id: '1' }]);
    const result = await LocalStorage.get('sessions', []);
    expect(result).toEqual([{ id: '1' }]);
  });
});
