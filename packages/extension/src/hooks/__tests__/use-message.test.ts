import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMessage } from '../use-message';

describe('sendMessage', () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
  });

  it('sends a message and returns the response', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ ok: true, data: 'pong' });
    const response = await sendMessage({ action: 'ping' });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'ping' });
    expect(response).toEqual({ ok: true, data: 'pong' });
  });

  it('returns error response on failure', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('disconnected'));
    const response = await sendMessage({ action: 'ping' });
    expect(response.ok).toBe(false);
    expect(response.error).toContain('disconnected');
  });
});
