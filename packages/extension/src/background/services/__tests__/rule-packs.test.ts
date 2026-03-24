import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from '../../message-bus';
import { registerRulePacks, validateRulePack } from '../rule-packs';
import { BUILT_IN_PACKS } from '@/data/built-in-packs';
import type { RulePack, Workspace } from '@/data/types';
import { createDefaultWorkspace, STORAGE_KEYS } from '@/shared/constants';

describe('RulePacks', () => {
  let bus: MessageBus;

  beforeEach(async () => {
    vi.clearAllMocks();
    bus = new MessageBus();
    registerRulePacks(bus);

    // Reset storage and set up default workspace
    const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
    for (const k of Object.keys(storageSyncData)) delete storageSyncData[k];
    for (const k of Object.keys(storageLocalData)) delete storageLocalData[k];

    // Set up a default workspace in storage
    const defaultWs = createDefaultWorkspace();
    storageLocalData[STORAGE_KEYS.WORKSPACES] = [defaultWs];
    storageSyncData[STORAGE_KEYS.SETTINGS] = { activeWorkspaceId: 'default' };
  });

  describe('getBuiltInPacks', () => {
    it('returns all 4 built-in packs', async () => {
      const result = await bus.dispatch({ action: 'getBuiltInPacks' });
      expect(result.ok).toBe(true);

      const packs = result.data as RulePack[];
      expect(packs).toHaveLength(4);
      expect(packs.map(p => p.name)).toEqual([
        'Web Developer',
        'Designer',
        'Researcher',
        'Social Media Manager',
      ]);
    });

    it('each pack has valid rules', async () => {
      for (const pack of BUILT_IN_PACKS) {
        expect(pack.rules.length).toBeGreaterThan(0);
        for (const rule of pack.rules) {
          expect(rule.id).toBeTruthy();
          expect(rule.type).toMatch(/^(prefix|domain|regex)$/);
          expect(rule.pattern).toBeTruthy();
          expect(rule.groupName).toBeTruthy();
          expect(rule.source).toBe('pack');
          expect(rule.enabled).toBe(true);
        }
      }
    });
  });

  describe('importRulePack', () => {
    it('imports rules into the active workspace', async () => {
      const pack = BUILT_IN_PACKS[0]; // Web Developer
      const result = await bus.dispatch({
        action: 'importRulePack',
        pack,
      });

      expect(result.ok).toBe(true);
      const data = result.data as { imported: number };
      expect(data.imported).toBe(pack.rules.length);

      // Verify rules are in workspace storage
      const { storageLocalData } = await import('../../../../tests/setup');
      const workspaces = storageLocalData[STORAGE_KEYS.WORKSPACES] as Workspace[];
      expect(workspaces[0].rules.length).toBe(pack.rules.length);
    });

    it('skips duplicate rules on re-import', async () => {
      const pack = BUILT_IN_PACKS[0];
      await bus.dispatch({ action: 'importRulePack', pack });

      // Import the same pack again
      const result = await bus.dispatch({ action: 'importRulePack', pack });
      const data = result.data as { imported: number };
      expect(data.imported).toBe(0); // All skipped as duplicates

      const { storageLocalData } = await import('../../../../tests/setup');
      const workspaces = storageLocalData[STORAGE_KEYS.WORKSPACES] as Workspace[];
      expect(workspaces[0].rules.length).toBe(pack.rules.length); // Still same count
    });

    it('rejects invalid pack format', async () => {
      const result = await bus.dispatch({
        action: 'importRulePack',
        pack: { name: 'bad' } as unknown as RulePack,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid rule pack');
    });
  });

  describe('exportRules', () => {
    it('exports workspace rules as a pack', async () => {
      // First import some rules
      await bus.dispatch({ action: 'importRulePack', pack: BUILT_IN_PACKS[0] });

      const result = await bus.dispatch({
        action: 'exportRules',
        name: 'My Rules',
        description: 'Test export',
      });

      expect(result.ok).toBe(true);
      const pack = result.data as RulePack;
      expect(pack.name).toBe('My Rules');
      expect(pack.description).toBe('Test export');
      expect(pack.rules.length).toBe(BUILT_IN_PACKS[0].rules.length);
      expect(pack.version).toBe('1.0.0');
    });

    it('exports empty pack when workspace has no rules', async () => {
      const result = await bus.dispatch({
        action: 'exportRules',
        name: 'Empty',
      });

      expect(result.ok).toBe(true);
      const pack = result.data as RulePack;
      expect(pack.rules).toHaveLength(0);
    });
  });

  describe('validateRulePack', () => {
    it('accepts valid packs', () => {
      expect(validateRulePack(BUILT_IN_PACKS[0])).toBe(true);
    });

    it('rejects null', () => {
      expect(validateRulePack(null)).toBe(false);
    });

    it('rejects objects missing required fields', () => {
      expect(validateRulePack({ name: 'test' })).toBe(false);
      expect(validateRulePack({ id: 'x', name: 'x', version: '1' })).toBe(false);
    });
  });
});
