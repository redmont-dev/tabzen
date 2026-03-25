import { sendMessage } from '@/hooks/use-message';
import type { Settings } from '@/data/types';

export async function applyTheme() {
  const res = await sendMessage<Settings>({ action: 'getSettings' });
  const theme = res.ok && res.data ? res.data.theme : 'system';
  setTheme(theme);
}

export function setTheme(theme: 'system' | 'light' | 'dark') {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}
