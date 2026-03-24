import { useState, useCallback } from 'preact/hooks';
import type { GroupingRule, Workspace, RuleType, TabGroupColor } from '@/data/types';
import { sendMessage } from '@/hooks/use-message';
import { TAB_GROUP_COLORS } from '@/shared/constants';
import { colorToVar } from '../../components/GroupHeader';
import styles from '../App.module.css';

interface Props {
  workspace: Workspace | null;
  onRefresh: () => void;
}

export function GroupingRulesSection({ workspace, onRefresh }: Props) {
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState({
    type: 'domain' as RuleType,
    pattern: '',
    groupName: '',
    color: 'blue' as TabGroupColor,
  });

  const rules = workspace?.rules ?? [];

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    if (!workspace) return;
    const updated = workspace.rules.filter(r => r.id !== ruleId);
    await sendMessage({
      action: 'updateWorkspace',
      workspaceId: workspace.id,
      updates: { rules: updated },
    });
    onRefresh();
  }, [workspace, onRefresh]);

  const handleToggleRule = useCallback(async (ruleId: string) => {
    if (!workspace) return;
    const updated = workspace.rules.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    await sendMessage({
      action: 'updateWorkspace',
      workspaceId: workspace.id,
      updates: { rules: updated },
    });
    onRefresh();
  }, [workspace, onRefresh]);

  const handleAddRule = useCallback(async () => {
    if (!workspace || !newRule.pattern || !newRule.groupName) return;
    const rule: GroupingRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: newRule.type,
      pattern: newRule.pattern,
      groupName: newRule.groupName,
      color: newRule.color,
      enabled: true,
      source: 'user',
    };
    await sendMessage({
      action: 'updateWorkspace',
      workspaceId: workspace.id,
      updates: { rules: [...workspace.rules, rule] },
    });
    setAdding(false);
    setNewRule({ type: 'domain', pattern: '', groupName: '', color: 'blue' });
    onRefresh();
  }, [workspace, newRule, onRefresh]);

  const handleTestUrl = useCallback(() => {
    if (!testUrl || rules.length === 0) {
      setTestResult(null);
      return;
    }

    for (const rule of rules) {
      if (!rule.enabled) continue;
      let matches = false;

      switch (rule.type) {
        case 'prefix':
          matches = testUrl.startsWith(rule.pattern);
          break;
        case 'domain': {
          try {
            const hostname = new URL(testUrl).hostname;
            if (rule.pattern.startsWith('*.')) {
              const base = rule.pattern.slice(2);
              matches = hostname === base || hostname.endsWith('.' + base);
            } else {
              matches = hostname === rule.pattern;
            }
          } catch { /* invalid URL */ }
          break;
        }
        case 'regex':
          try { matches = new RegExp(rule.pattern).test(testUrl); } catch { /* invalid regex */ }
          break;
      }

      if (matches) {
        setTestResult(rule.groupName);
        return;
      }
    }
    setTestResult('');
  }, [testUrl, rules]);

  return (
    <div>
      <h2 class={styles.pageTitle}>Grouping Rules</h2>

      <div class={styles.sectionBlock}>
        <table class={styles.rulesTable}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Pattern</th>
              <th>Group</th>
              <th>Color</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map(rule => (
              <tr key={rule.id}>
                <td>{rule.type}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{rule.pattern}</td>
                <td>{rule.groupName}</td>
                <td>
                  <span class={styles.colorDot} style={{ background: colorToVar(rule.color) }} />
                  {rule.color}
                </td>
                <td>
                  <input
                    type="checkbox"
                    class={styles.checkbox}
                    checked={rule.enabled}
                    onChange={() => handleToggleRule(rule.id)}
                  />
                </td>
                <td>
                  <button class={styles.button} onClick={() => handleDeleteRule(rule.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={6} style={{ color: 'var(--text-tertiary)' }}>No rules defined</td></tr>
            )}
          </tbody>
        </table>

        {adding ? (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div class={styles.fieldDescription}>Type</div>
              <select
                class={styles.select}
                value={newRule.type}
                onChange={(e) => setNewRule({ ...newRule, type: (e.target as HTMLSelectElement).value as RuleType })}
              >
                <option value="prefix">Prefix</option>
                <option value="domain">Domain</option>
                <option value="regex">Regex</option>
              </select>
            </div>
            <div>
              <div class={styles.fieldDescription}>Pattern</div>
              <input
                class={styles.input}
                value={newRule.pattern}
                onInput={(e) => setNewRule({ ...newRule, pattern: (e.target as HTMLInputElement).value })}
                placeholder={newRule.type === 'domain' ? '*.example.com' : ''}
              />
            </div>
            <div>
              <div class={styles.fieldDescription}>Group name</div>
              <input
                class={styles.input}
                value={newRule.groupName}
                onInput={(e) => setNewRule({ ...newRule, groupName: (e.target as HTMLInputElement).value })}
              />
            </div>
            <div>
              <div class={styles.fieldDescription}>Color</div>
              <select
                class={styles.select}
                value={newRule.color}
                onChange={(e) => setNewRule({ ...newRule, color: (e.target as HTMLSelectElement).value as TabGroupColor })}
              >
                {TAB_GROUP_COLORS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button class={styles.button} onClick={handleAddRule}>Add</button>
            <button class={styles.button} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        ) : (
          <button class={styles.button} style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
            Add rule
          </button>
        )}
      </div>

      <div class={styles.sectionBlock}>
        <div class={styles.sectionLabel}>Test URL</div>
        <div class={styles.ruleTestSection}>
          <input
            class={styles.input}
            value={testUrl}
            onInput={(e) => setTestUrl((e.target as HTMLInputElement).value)}
            placeholder="https://example.com/page"
          />
          <button class={styles.button} onClick={handleTestUrl}>Test</button>
          {testResult !== null && (
            <span class={`${styles.ruleTestResult} ${testResult ? styles.ruleTestMatch : styles.ruleTestNoMatch}`}>
              {testResult || 'No match'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
