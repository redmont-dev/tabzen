import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, updateSettings } from '../settings';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/constants';

describe('settings', () => {
  beforeEach(async () => {
    const { storageSyncData } = await import('../../../tests/setup');
    for (const k of Object.keys(storageSyncData)) delete storageSyncData[k];
  });

  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists a mutation and returns what was written', async () => {
    const result = await updateSettings(s => ({ ...s, dedupEnabled: false }));

    expect(result.dedupEnabled).toBe(false);
    expect((await getSettings()).dedupEnabled).toBe(false);
  });

  it('does not lose concurrent writes to different fields', async () => {
    // Both start before either finishes — the losing read would otherwise
    // overwrite the other's change with its own stale copy.
    await Promise.all([
      updateSettings(s => ({ ...s, dedupEnabled: false })),
      updateSettings(s => ({ ...s, newTabPageEnabled: false })),
      updateSettings(s => ({ ...s, activeWorkspaceId: 'work' })),
    ]);

    const settings = await getSettings();
    expect(settings.dedupEnabled).toBe(false);
    expect(settings.newTabPageEnabled).toBe(false);
    expect(settings.activeWorkspaceId).toBe('work');
  });

  it('applies concurrent increments to the same field in order', async () => {
    await updateSettings(s => ({ ...s, autoSaveDailyTime: '00:00' }));

    await Promise.all(
      ['01:00', '02:00', '03:00'].map(time =>
        updateSettings(s => ({ ...s, autoSaveDailyTime: time })),
      ),
    );

    expect((await getSettings()).autoSaveDailyTime).toBe('03:00');
  });

  it('keeps serving later writes after one mutation throws', async () => {
    await expect(
      updateSettings(() => { throw new Error('boom'); }),
    ).rejects.toThrow('boom');

    await updateSettings(s => ({ ...s, dedupEnabled: false }));
    expect((await getSettings()).dedupEnabled).toBe(false);
  });

  it('writes to the shared settings key', async () => {
    const { storageSyncData } = await import('../../../tests/setup');
    await updateSettings(s => ({ ...s, theme: 'dark' }));
    expect(storageSyncData[STORAGE_KEYS.SETTINGS]).toMatchObject({ theme: 'dark' });
  });
});
