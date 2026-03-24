import { useState, useCallback } from 'preact/hooks';
import type { Workspace } from '@/data/types';
import { sendMessage } from '@/hooks/use-message';
import styles from '../App.module.css';

interface Props {
  workspaces: Workspace[];
  onRefresh: () => void;
}

export function WorkspacesSection({ workspaces, onRefresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    await sendMessage({ action: 'createWorkspace', name: newName.trim(), icon: newIcon.trim() });
    setCreating(false);
    setNewName('');
    setNewIcon('');
    onRefresh();
  }, [newName, newIcon, onRefresh]);

  const handleDelete = useCallback(async (id: string) => {
    if (id === 'default') return;
    await sendMessage({ action: 'deleteWorkspace', workspaceId: id });
    onRefresh();
  }, [onRefresh]);

  const handleStartEdit = useCallback((ws: Workspace) => {
    setEditingId(ws.id);
    setEditName(ws.name);
    setEditIcon(ws.icon);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) return;
    await sendMessage({
      action: 'updateWorkspace',
      workspaceId: editingId,
      updates: { name: editName.trim(), icon: editIcon.trim() },
    });
    setEditingId(null);
    onRefresh();
  }, [editingId, editName, editIcon, onRefresh]);

  return (
    <div>
      <h2 class={styles.pageTitle}>Workspaces</h2>

      <div class={styles.sectionBlock}>
        <table class={styles.rulesTable}>
          <thead>
            <tr>
              <th>Icon</th>
              <th>Name</th>
              <th>Rules</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map(ws => (
              <tr key={ws.id}>
                <td style={{ width: 40 }}>
                  {editingId === ws.id ? (
                    <input
                      class={styles.input}
                      style={{ width: 40 }}
                      value={editIcon}
                      onInput={(e) => setEditIcon((e.target as HTMLInputElement).value)}
                    />
                  ) : (
                    ws.icon || '--'
                  )}
                </td>
                <td>
                  {editingId === ws.id ? (
                    <input
                      class={styles.input}
                      value={editName}
                      onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                    />
                  ) : (
                    ws.name
                  )}
                </td>
                <td>{ws.rules.length}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {editingId === ws.id ? (
                    <>
                      <button class={styles.button} onClick={handleSaveEdit}>Save</button>{' '}
                      <button class={styles.button} onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button class={styles.button} onClick={() => handleStartEdit(ws)}>Edit</button>
                      {ws.id !== 'default' && (
                        <>
                          {' '}
                          <button
                            class={`${styles.button} ${styles.buttonDanger}`}
                            onClick={() => handleDelete(ws.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {creating ? (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <div class={styles.fieldDescription}>Name</div>
              <input
                class={styles.input}
                value={newName}
                onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
                placeholder="Workspace name"
              />
            </div>
            <div>
              <div class={styles.fieldDescription}>Icon</div>
              <input
                class={styles.input}
                style={{ width: 60 }}
                value={newIcon}
                onInput={(e) => setNewIcon((e.target as HTMLInputElement).value)}
                placeholder="icon"
              />
            </div>
            <button class={styles.button} onClick={handleCreate}>Create</button>
            <button class={styles.button} onClick={() => setCreating(false)}>Cancel</button>
          </div>
        ) : (
          <button class={styles.button} style={{ marginTop: 12 }} onClick={() => setCreating(true)}>
            New workspace
          </button>
        )}
      </div>
    </div>
  );
}
