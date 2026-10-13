import type { Settings } from './types';
import { SyncStorage } from './storage';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/constants';

/**
 * Serialized access to the settings object.
 *
 * Settings live in one chrome.storage.sync key, so every writer has to read,
 * merge and write the whole thing. Two of those interleaving — the options page
 * toggling auto-save while the side panel switches workspace — means whichever
 * read first silently overwrites the other's change. Chaining every mutation
 * onto a single promise makes each one see the previous one's result.
 *
 * All settings writes happen in the service worker (UI pages go through the
 * message bus), so a single in-worker queue covers every writer.
 */
let queue: Promise<unknown> = Promise.resolve();

export async function getSettings(): Promise<Settings> {
  return SyncStorage.get<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

/**
 * Apply `mutate` to the current settings and persist the result.
 * Returns the settings as written.
 */
export function updateSettings(
  mutate: (current: Settings) => Settings,
): Promise<Settings> {
  const next = queue.then(async () => {
    const current = await getSettings();
    const updated = mutate(current);
    await SyncStorage.set(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  });
  // Keep the chain alive even if this mutation throws, so one failure does not
  // wedge every later write.
  queue = next.catch(() => undefined);
  return next;
}
