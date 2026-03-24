import { useEffect, useCallback } from 'preact/hooks';

interface KeyboardNavOptions {
  itemCount: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onConfirm: (index: number) => void;
  onDismiss: () => void;
  enabled?: boolean;
}

export function useKeyboardNav({
  itemCount,
  selectedIndex,
  onSelect,
  onConfirm,
  onDismiss,
  enabled = true,
}: KeyboardNavOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onSelect(selectedIndex < itemCount - 1 ? selectedIndex + 1 : 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSelect(selectedIndex > 0 ? selectedIndex - 1 : itemCount - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < itemCount) {
            onConfirm(selectedIndex);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onDismiss();
          break;
      }
    },
    [enabled, itemCount, selectedIndex, onSelect, onConfirm, onDismiss],
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}
