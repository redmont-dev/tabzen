import styles from './TabItem.module.css';

interface TabItemProps {
  id: number;
  title: string;
  url: string;
  favIconUrl: string | null;
  active: boolean;
  isPriority?: boolean;
  ungrouped?: boolean;
  onActivate: (tabId: number) => void;
  onClose: (tabId: number) => void;
}

function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function TabItem({
  id, title, url, favIconUrl, active, isPriority, ungrouped, onActivate, onClose,
}: TabItemProps) {
  return (
    <div
      class={`${styles.item} ${active ? styles.itemActive : ''} ${ungrouped ? styles.itemUngrouped : ''}`}
      onClick={() => onActivate(id)}
      role="button"
      tabIndex={0}
    >
      {favIconUrl ? (
        <img class={styles.favicon} src={favIconUrl} alt="" loading="lazy" />
      ) : (
        <span class={styles.faviconPlaceholder} />
      )}
      <span class={styles.title}>{title || displayUrl(url)}</span>
      {isPriority && <span class={styles.priority} title="Priority tab">*</span>}
      <span class={styles.url}>{displayUrl(url)}</span>
      <button
        class={styles.close}
        onClick={(e) => { e.stopPropagation(); onClose(id); }}
        title="Close tab"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="2" y1="2" x2="8" y2="8" />
          <line x1="8" y1="2" x2="2" y2="8" />
        </svg>
      </button>
    </div>
  );
}
