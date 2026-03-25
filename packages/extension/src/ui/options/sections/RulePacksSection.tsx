import { useState, useEffect, useCallback } from 'preact/hooks';
import type { RulePack, GroupingRule } from '@/data/types';
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

function CreatePackForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allRules, setAllRules] = useState<GroupingRule[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await sendMessage<RulePack>({ action: 'exportRules', name: '' });
      if (res.ok && res.data) {
        setAllRules(res.data.rules);
        setSelected(new Set(res.data.rules.map(r => r.id)));
      }
      setLoading(false);
    })();
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allRules.map(r => r.id)));
  const selectNone = () => setSelected(new Set());

  const handleExport = () => {
    if (!name.trim()) return;
    const selectedRules = allRules.filter(r => selected.has(r.id));
    const pack: RulePack = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      author: 'Custom',
      version: '1.0.0',
      rules: selectedRules,
      priorityRules: [],
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.trim().toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  if (loading) return <div class={styles.fieldDescription}>Loading rules...</div>;

  if (allRules.length === 0) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div class={styles.fieldDescription}>No rules to export. Create some grouping rules first.</div>
        <button class={styles.button} onClick={onClose} style={{ marginTop: 8 }}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
      <div style={{ marginBottom: 12 }}>
        <div class={styles.fieldLabel}>Pack name</div>
        <input
          class={styles.input}
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="My Rule Pack"
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 3 }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div class={styles.fieldLabel}>Description (optional)</div>
        <input
          class={styles.input}
          value={description}
          onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
          placeholder="Rules for..."
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 3 }}
        />
      </div>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div class={styles.fieldLabel}>Select rules ({selected.size} of {allRules.length})</div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
          <span onClick={selectAll} style={{ cursor: 'pointer', color: 'var(--text-secondary)', textDecoration: 'underline' }}>All</span>
          <span onClick={selectNone} style={{ cursor: 'pointer', color: 'var(--text-secondary)', textDecoration: 'underline' }}>None</span>
        </div>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 3 }}>
        {allRules.map(rule => (
          <label key={rule.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
            borderBottom: '1px solid var(--border-light)', cursor: 'pointer', fontSize: 12,
          }}>
            <input type="checkbox" checked={selected.has(rule.id)} onChange={() => toggle(rule.id)} />
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: COLOR_MAP[rule.color] || '#999', flexShrink: 0,
            }} />
            <span style={{ color: 'var(--text-secondary)', marginRight: 4 }}>{rule.type}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{rule.pattern}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{rule.groupName}</span>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button class={styles.button} onClick={handleExport} disabled={!name.trim() || selected.size === 0}>
          Export {selected.size} rule{selected.size !== 1 ? 's' : ''}
        </button>
        <button class={styles.button} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export function RulePacksSection() {
  const [packs, setPacks] = useState<RulePack[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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

  const handleExportAll = useCallback(async () => {
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

  const [applyStatus, setApplyStatus] = useState<string | null>(null);

  const handleApplyPack = useCallback(async (pack: RulePack) => {
    setApplyStatus(null);
    const res = await sendMessage<{ imported: number }>({ action: 'importRulePack', pack });
    if (res.ok && res.data) {
      const count = res.data.imported;
      setApplyStatus(count > 0 ? `Added ${count} rule${count !== 1 ? 's' : ''} from "${pack.name}"` : `All rules from "${pack.name}" already exist`);
    } else {
      setApplyStatus(`Failed to apply: ${res.error || 'Unknown error'}`);
    }
    setTimeout(() => setApplyStatus(null), 4000);
  }, []);

  return (
    <div>
      <h2 class={styles.pageTitle}>Rule Packs</h2>

      <div class={styles.sectionBlock}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button class={styles.button} onClick={handleImport}>Import pack</button>
          <button class={styles.button} onClick={handleExportAll}>Export all rules</button>
          <button class={styles.button} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : 'Create custom pack'}
          </button>
        </div>

        {applyStatus && (
          <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--text-secondary)' }}>{applyStatus}</div>
        )}

        {showCreate && <CreatePackForm onClose={() => setShowCreate(false)} />}

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
