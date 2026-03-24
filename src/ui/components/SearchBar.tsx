import { useRef, useEffect } from 'preact/hooks';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  shortcutHint?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search tabs...',
  shortcutHint,
  autoFocus,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div class={styles.wrapper}>
      <input
        ref={inputRef}
        class={`${styles.input} ${value ? styles.inputFilled : ''}`}
        type="text"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
      />
      {shortcutHint && !value && (
        <span class={styles.hint}>{shortcutHint}</span>
      )}
    </div>
  );
}
