import { useState, useCallback } from 'preact/hooks';
import type { Workspace, PriorityRule, TabGroupColor } from '@/data/types';
import { sendMessage } from '@/hooks/use-message';
import { TAB_GROUP_COLORS } from '@/shared/constants';
import { colorToVar } from '../../components/GroupHeader';
import styles from '../App.module.css';

interface Props {
  workspace: Workspace | null;
  onRefresh: () => void;
}

export function PriorityUrlsSection({ workspace, onRefresh }: Props) {
  const [adding, setAdding] = useState(false);
  const [newPrefix, setNewPrefix] = useState('');
  const [newColors, setNewColors] = useState<TabGroupColor[]>([]);

  const rules = workspace?.priorityRules ?? [];

  const toggleColor = useCallback((color: TabGroupColor) => {
    setNewColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    );
  }, []);

  const handleAdd = useCallback(async () => {
    if (!workspace || !newPrefix.trim() || newColors.length === 0) return;
    const rule: PriorityRule = {
      id: `pri-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      urlPrefix: newPrefix.trim(),
      colors: newColors,
    };
    await sendMessage({
      action: 'updateWorkspace',
      workspaceId: workspace.id,
      updates: { priorityRules: [...workspace.priorityRules, rule] },
    });
    setAdding(false);
    setNewPrefix('');
    setNewColors([]);
    onRefresh();
  }, [workspace, newPrefix, newColors, onRefresh]);

  const handleDelete = useCallback(async (ruleId: string) => {
    if (!workspace) return;
    const updated = workspace.priorityRules.filter(r => r.id !== ruleId);
    await sendMessage({
      action: 'updateWorkspace',
      workspaceId: workspace.id,
      updates: { priorityRules: updated },
    });
    onRefresh();
  }, [workspace, onRefresh]);

  return (
    <div>
      <h2 class={styles.pageTitle}>Priority URLs</h2>

      <div class={styles.sectionBlock}>
        <div class={styles.fieldDescription} style={{ marginBottom: 12 }}>
          Tabs matching these URL prefixes will be placed in groups with the specified colors, overriding normal rules.
        </div>

        <table class={styles.rulesTable}>
          <thead>
            <tr>
              <th>URL Prefix</th>
              <th>Colors</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map(rule => (
              <tr key={rule.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{rule.urlPrefix}</td>
                <td>
                  {rule.colors.map(c => (
                    <span key={c} class={styles.colorDot} style={{ background: colorToVar(c) }} title={c} />
                  ))}
                </td>
                <td>
                  <button class={styles.button} onClick={() => handleDelete(rule.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={3} style={{ color: 'var(--text-tertiary)' }}>No priority rules defined</td></tr>
            )}
          </tbody>
        </table>

        {adding ? (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div class={styles.fieldDescription}>URL prefix</div>
              <input
                class={styles.input}
                value={newPrefix}
                onInput={(e) => setNewPrefix((e.target as HTMLInputElement).value)}
                placeholder="https://important.example.com"
              />
            </div>
            <div>
              <div class={styles.fieldDescription}>Colors (click to toggle)</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {TAB_GROUP_COLORS.map(c => (
                  <span
                    key={c}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: colorToVar(c),
                      cursor: 'pointer',
                      opacity: newColors.includes(c) ? 1 : 0.25,
                      border: newColors.includes(c) ? '2px solid var(--text-primary)' : '2px solid transparent',
                    }}
                    onClick={() => toggleColor(c)}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <button class={styles.button} onClick={handleAdd}>Add</button>
            <button class={styles.button} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        ) : (
          <button class={styles.button} style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
            Add priority rule
          </button>
        )}
      </div>
    </div>
  );
}
