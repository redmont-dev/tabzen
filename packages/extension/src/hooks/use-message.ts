import { useState, useCallback } from 'preact/hooks';
import type { MessageRequest, MessageResponse } from '@/shared/messages';

export async function sendMessage<T = unknown>(
  request: MessageRequest,
): Promise<MessageResponse<T>> {
  try {
    return await chrome.runtime.sendMessage(request);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function useMessage<T = unknown>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (request: MessageRequest): Promise<T | null> => {
    setLoading(true);
    setError(null);
    const response = await sendMessage<T>(request);
    setLoading(false);
    if (!response.ok) {
      setError(response.error ?? 'Unknown error');
      return null;
    }
    return response.data ?? null;
  }, []);

  return { send, loading, error };
}
