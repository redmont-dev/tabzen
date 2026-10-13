import { useState, useEffect, useCallback } from 'preact/hooks';

export interface CommandBinding {
  name: string;
  description: string;
  shortcut: string | null;
}

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

/**
 * Render a Chrome accelerator ("Command+Shift+S") the way the platform writes
 * it. Chrome always reports the canonical word form regardless of platform.
 */
export function formatShortcut(shortcut: string | null): string {
  if (!shortcut) return 'Not set';
  if (!isMac) return shortcut;
  return shortcut
    .split('+')
    .map(part => {
      switch (part) {
        case 'Command':
        case 'MacCtrl':
          return '⌘';
        case 'Ctrl':
          return '⌃';
        case 'Shift':
          return '⇧';
        case 'Alt':
          return '⌥';
        default:
          return part;
      }
    })
    .join('');
}

/**
 * Live keyboard bindings straight from Chrome, so the UI reflects whatever the
 * user actually has bound — including customizations made at
 * chrome://extensions/shortcuts and commands left unbound.
 */
export function useCommands(): { commands: CommandBinding[]; refresh: () => void } {
  const [commands, setCommands] = useState<CommandBinding[]>([]);

  const refresh = useCallback(async () => {
    try {
      const all = await chrome.commands.getAll();
      setCommands(
        all.map(c => ({
          name: c.name ?? '',
          description: c.description ?? '',
          shortcut: c.shortcut ? c.shortcut : null,
        })),
      );
    } catch (err) {
      console.warn('Failed to read command bindings:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Rebinding happens on Chrome's own page, which gives us no event. Re-read
    // when the user comes back so a change shows up without a manual reload.
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  return { commands, refresh };
}

/** Look up one command's shortcut for display next to an action button. */
export function shortcutFor(commands: CommandBinding[], name: string): string | null {
  return commands.find(c => c.name === name)?.shortcut ?? null;
}
