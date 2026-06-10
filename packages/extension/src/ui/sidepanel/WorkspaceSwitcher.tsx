import { useState, useEffect, useCallback } from 'preact/hooks';
import { sendMessage } from '@/hooks/use-message';
import type { Workspace } from '@/data/types';
import styles from './WorkspaceSwitcher.module.css';

interface WorkspaceSwitcherProps {
  windowId: number | null;
  onSwitched?: (workspace: Workspace) => void;
}

export function WorkspaceSwitcher({ windowId, onSwitched }: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState('default');

  useEffect(() => {
    (async () => {
      const wsRes = await sendMessage<Workspace[]>({ action: 'getWorkspaces' });
      if (wsRes.ok && wsRes.data) setWorkspaces(wsRes.data);

      const activeRes = await sendMessage<Workspace>({ action: 'getActiveWorkspace' });
      if (activeRes.ok && activeRes.data) setActiveId(activeRes.data.id);
    })();
  }, []);

  const handleSwitch = useCallback(async (workspace: Workspace) => {
    if (workspace.id === activeId || windowId === null) return;
    const res = await sendMessage({
      action: 'switchWorkspace',
      workspaceId: workspace.id,
      fullSwitch: false,
      windowId,
    });
    if (res.ok) {
      setActiveId(workspace.id);
      onSwitched?.(workspace);
    }
  }, [activeId, windowId, onSwitched]);

  if (workspaces.length === 0) return null;

  return (
    <div class={styles.switcher}>
      {workspaces.map(ws => (
        <button
          key={ws.id}
          class={`${styles.pill} ${ws.id === activeId ? styles.pillActive : ''}`}
          onClick={() => handleSwitch(ws)}
        >
          {ws.icon ? `${ws.icon} ` : ''}{ws.name}
        </button>
      ))}
    </div>
  );
}
