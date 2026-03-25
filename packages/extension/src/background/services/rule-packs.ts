import type { MessageBus } from '../message-bus';
import type { RulePack, GroupingRule, Workspace } from '@/data/types';
import { LocalStorage } from '@/data/storage';
import { STORAGE_KEYS } from '@/shared/constants';
import { BUILT_IN_PACKS } from '@/data/built-in-packs';

function generateId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validateRulePack(pack: unknown): pack is RulePack {
  if (!pack || typeof pack !== 'object') return false;
  const p = pack as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.version === 'string' &&
    Array.isArray(p.rules)
  );
}

async function getActiveWorkspace(): Promise<{ workspace: Workspace; index: number; workspaces: Workspace[] }> {
  const { SyncStorage } = await import('@/data/storage');
  const { DEFAULT_SETTINGS, createDefaultWorkspace } = await import('@/shared/constants');
  const settings = await SyncStorage.get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  let workspaces = await LocalStorage.get<Workspace[]>(STORAGE_KEYS.WORKSPACES, []);

  // Auto-create default workspace if none exist
  if (workspaces.length === 0) {
    const defaultWs = createDefaultWorkspace();
    workspaces = [defaultWs];
    await LocalStorage.set(STORAGE_KEYS.WORKSPACES, workspaces);
  }

  let index = workspaces.findIndex(w => w.id === settings.activeWorkspaceId);
  if (index === -1) index = 0; // Fallback to first workspace
  return { workspace: workspaces[index], index, workspaces };
}

async function importRulePack(pack: RulePack): Promise<number> {
  const { workspace, index, workspaces } = await getActiveWorkspace();

  // Assign new IDs to imported rules to avoid collisions
  const existingPatterns = new Set(workspace.rules.map(r => `${r.type}::${r.pattern}`));
  const newRules: GroupingRule[] = [];

  for (const rule of pack.rules) {
    const key = `${rule.type}::${rule.pattern}`;
    if (existingPatterns.has(key)) continue; // Skip duplicates

    newRules.push({
      ...rule,
      id: generateId(),
      source: 'pack',
    });
    existingPatterns.add(key);
  }

  workspaces[index] = {
    ...workspace,
    rules: [...workspace.rules, ...newRules],
  };

  await LocalStorage.set(STORAGE_KEYS.WORKSPACES, workspaces);
  return newRules.length;
}

async function exportRules(name: string, description?: string): Promise<RulePack> {
  const { workspace } = await getActiveWorkspace();

  return {
    id: `pack-export-${Date.now()}`,
    name,
    description: description ?? `Rules exported from workspace "${workspace.name}"`,
    author: 'User',
    version: '1.0.0',
    rules: workspace.rules.map(r => ({ ...r })),
    priorityRules: workspace.priorityRules.map(r => ({ ...r })),
  };
}

export { validateRulePack, importRulePack, exportRules };

export function registerRulePacks(bus: MessageBus): void {
  bus.register('getBuiltInPacks', async () => {
    return { ok: true, data: BUILT_IN_PACKS };
  });

  bus.register('importRulePack', async (req) => {
    if (!validateRulePack(req.pack)) {
      return { ok: false, error: 'Invalid rule pack format' };
    }
    const imported = await importRulePack(req.pack);
    return { ok: true, data: { imported } };
  });

  bus.register('exportRules', async (req) => {
    const pack = await exportRules(req.name, req.description);
    return { ok: true, data: pack };
  });
}
