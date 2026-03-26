import { useState, useEffect, useCallback } from 'preact/hooks';
import styles from './Toast.module.css';

interface ToastMessage {
  text: string;
  id: number;
}

let showToastFn: ((text: string) => void) | null = null;

export function showToast(text: string) {
  showToastFn?.(text);
}

export function ToastContainer() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const show = useCallback((text: string) => {
    setToast({ text, id: Date.now() });
  }, []);

  useEffect(() => {
    showToastFn = show;
    return () => { showToastFn = null; };
  }, [show]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div key={toast.id} class={styles.toast}>
      {toast.text}
    </div>
  );
}
