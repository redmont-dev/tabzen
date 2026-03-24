import { describe, it, expect, beforeEach } from 'vitest';
import { MessageBus } from '../message-bus';

describe('MessageBus', () => {
  let bus: MessageBus;

  beforeEach(() => { bus = new MessageBus(); });

  it('registers and dispatches a handler', async () => {
    bus.register('ping', async () => ({ ok: true, data: 'pong' }));
    const response = await bus.dispatch({ action: 'ping' });
    expect(response).toEqual({ ok: true, data: 'pong' });
  });

  it('returns error for unregistered action', async () => {
    const response = await bus.dispatch({ action: 'ping' });
    expect(response.ok).toBe(false);
    expect(response.error).toContain('No handler');
  });

  it('catches handler errors and returns error response', async () => {
    bus.register('ping', async () => { throw new Error('boom'); });
    const response = await bus.dispatch({ action: 'ping' });
    expect(response.ok).toBe(false);
    expect(response.error).toBe('boom');
  });

  it('prevents duplicate handler registration', () => {
    bus.register('ping', async () => ({ ok: true }));
    expect(() => { bus.register('ping', async () => ({ ok: true })); }).toThrow('already registered');
  });
});
