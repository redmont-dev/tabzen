import { useRef, useEffect } from 'preact/hooks';
import { colorToVar } from './GroupHeader';
import styles from './SearchResults.module.css';

export interface SearchResultItem {
  tabId: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl: string | null;
  groupName: string | null;
  groupColor: string | null;
}

interface SearchResultsProps {
  results: SearchResultItem[];
  selectedIndex: number;
  onSelect: (tabId: number, windowId: number) => void;
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
          key={r.tabId}
          class={`${styles.resultItem} ${i === selectedIndex ? styles.resultItemSelected : ''}`}
          onClick={() => onSelect(r.tabId, r.windowId)}
          role="option"
          aria-selected={i === selectedIndex}
        >
          {r.favIconUrl ? (
            <img class={styles.favicon} src={r.favIconUrl} alt="" loading="lazy" />
          ) : (
            <span class={styles.faviconPlaceholder} />
          )}
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
        </div>
      ))}
    </div>
  );
}
