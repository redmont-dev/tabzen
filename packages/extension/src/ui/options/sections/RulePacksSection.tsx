import { useState, useEffect, useCallback } from 'preact/hooks';
import type { RulePack } from '@/data/types';
import { sendMessage } from '@/hooks/use-message';
import styles from '../App.module.css';

export function RulePacksSection() {
  const [packs, setPacks] = useState<RulePack[]>([]);

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
        // Reload built-in packs
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
                  {pack.rules.length} rules, {pack.priorityRules.length} priority rules
                </div>
                <button class={styles.button} onClick={() => handleApplyPack(pack)}>Apply</button>
              </div>
            </div>
          ))
        ) : (
          <div class={styles.fieldDescription}>No built-in rule packs available.</div>
        )}
      </div>
    </div>
  );
}
