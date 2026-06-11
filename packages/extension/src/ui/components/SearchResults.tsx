import { useRef, useEffect } from 'preact/hooks';
import { colorToVar } from './GroupHeader';
import styles from './SearchResults.module.css';

export interface TabResultItem {
  kind: 'tab';
  tabId: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl: string | null;
  groupName: string | null;
  groupColor: string | null;
}

export interface SessionResultItem {
  kind: 'session';
  sessionId: string;
  name: string;
  tabCount: number;
  createdAt: number;
}

export type SearchResultItem = TabResultItem | SessionResultItem;

interface SearchResultsProps {
  results: SearchResultItem[];
  selectedIndex: number;
  onSelect: (item: SearchResultItem) => void;
  visible: boolean;
}

export function SearchResults({ results, selectedIndex, onSelect, visible }: SearchResultsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!visible || results.length === 0) return null;

  return (
    <div class={styles.list} ref={listRef}>
      {results.map((r, i) => (
        <div
          key={r.kind === 'tab' ? `tab-${r.tabId}` : `session-${r.sessionId}`}
          class={`${styles.resultItem} ${i === selectedIndex ? styles.resultItemSelected : ''}`}
          onClick={() => onSelect(r)}
          role="option"
          aria-selected={i === selectedIndex}
        >
          {r.kind === 'tab' && r.favIconUrl ? (
            <img class={styles.favicon} src={r.favIconUrl} alt="" loading="lazy" />
          ) : (
            <span class={styles.faviconPlaceholder} />
          )}
          {r.kind === 'tab' ? (
            <>
              <div class={styles.info}>
                <span class={styles.resultTitle}>{r.title}</span>
                <span class={styles.resultUrl}>{r.url}</span>
              </div>
              {r.groupName && (
                <span class={styles.groupBadge}>
                  <span
                    class={styles.groupDot}
                    style={{ background: r.groupColor ? colorToVar(r.groupColor) : 'var(--group-grey)' }}
                  />
                  {r.groupName}
                </span>
              )}
            </>
          ) : (
            <>
              <div class={styles.info}>
                <span class={styles.resultTitle}>{r.name}</span>
                <span class={styles.resultUrl}>{r.tabCount} {r.tabCount === 1 ? 'tab' : 'tabs'} &middot; restore session</span>
              </div>
              <span class={styles.groupBadge}>Session</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
