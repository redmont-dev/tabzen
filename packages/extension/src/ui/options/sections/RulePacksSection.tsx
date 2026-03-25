import { useState, useEffect, useCallback } from 'preact/hooks';
import type { RulePack } from '@/data/types';
import { sendMessage } from '@/hooks/use-message';
import styles from '../App.module.css';

const COLOR_MAP: Record<string, string> = {
  grey: '#999', blue: '#3b82f6', red: '#ef4444', yellow: '#eab308',
  green: '#22c55e', pink: '#ec4899', purple: '#a855f7', cyan: '#06b6d4', orange: '#f97316',
};

function PackRuleList({ pack }: { pack: RulePack }) {
  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
            <th style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Type</th>
            <th style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Pattern</th>
            <th style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Group</th>
          </tr>
        </thead>
        <tbody>
          {pack.rules.map(rule => (
            <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{rule.type}</td>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>{rule.pattern}</td>
              <td style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: COLOR_MAP[rule.color] || '#999', flexShrink: 0,
                }} />
                {rule.groupName}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RulePacksSection() {
  const [packs, setPacks] = useState<RulePack[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await sendMessage<RulePack[]>({ action: 'getBuiltInPacks' });
      if (res.ok && res.data) {
        setPacks(res.data);
      }
    })();
  }, []);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const pack = JSON.parse(text) as RulePack;
        await sendMessage({ action: 'importRulePack', pack });
        const res = await sendMessage<RulePack[]>({ action: 'getBuiltInPacks' });
        if (res.ok && res.data) setPacks(res.data);
      } catch {
        // Import failed silently
      }
    };
    input.click();
  }, []);

  const handleExport = useCallback(async () => {
    const res = await sendMessage<RulePack>({ action: 'exportRules', name: 'My Rules' });
    if (res.ok && res.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tabzen-rules.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleApplyPack = useCallback(async (pack: RulePack) => {
    await sendMessage({ action: 'importRulePack', pack });
  }, []);

  return (
    <div>
      <h2 class={styles.pageTitle}>Rule Packs</h2>

      <div class={styles.sectionBlock}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button class={styles.button} onClick={handleImport}>Import pack</button>
          <button class={styles.button} onClick={handleExport}>Export current rules</button>
        </div>

        {packs.length > 0 ? (
          packs.map(pack => (
            <div key={pack.id} class={styles.packCard}>
              <div class={styles.packName}>{pack.name}</div>
              <div class={styles.packDescription}>{pack.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div class={styles.packRuleCount}>
                  {pack.rules.length} rules
                  <span
                    onClick={() => setExpandedId(expandedId === pack.id ? null : pack.id)}
                    style={{ marginLeft: 8, cursor: 'pointer', color: 'var(--text-primary)', textDecoration: 'underline' }}
                  >
                    {expandedId === pack.id ? 'Hide rules' : 'View rules'}
                  </span>
                </div>
                <button class={styles.button} onClick={() => handleApplyPack(pack)}>Apply</button>
              </div>
              {expandedId === pack.id && <PackRuleList pack={pack} />}
            </div>
          ))
        ) : (
          <div class={styles.fieldDescription}>No built-in rule packs available.</div>
        )}
      </div>
    </div>
  );
}
