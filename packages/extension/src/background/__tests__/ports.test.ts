import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initPortManager } from '../ports';
import { PORT_NAME } from '@/shared/constants';

type Listener = (...args: unknown[]) => void;

interface FakePort {
  name: string;
  postMessage: ReturnType<typeof vi.fn>;
  onMessage: { addListener: (fn: Listener) => void };
  onDisconnect: { addListener: (fn: Listener) => void };
  emit: (message: unknown) => void;
  disconnect: () => void;
}

function fakePort(name = PORT_NAME): FakePort {
  const messageListeners: Listener[] = [];
  const disconnectListeners: Listener[] = [];
  return {
    name,
    postMessage: vi.fn(),
    onMessage: { addListener: (fn: Listener) => messageListeners.push(fn) },
    onDisconnect: { addListener: (fn: Listener) => disconnectListeners.push(fn) },
    emit: (message: unknown) => messageListeners.forEach(fn => fn(message)),
    disconnect: () => disconnectListeners.forEach(fn => fn()),
  };
}

/** Tabs keyed by window, so a query for window 2 cannot return window 1's tabs. */
function mockWindows(byWindow: Record<number, number[]>): void {
  vi.mocked(chrome.tabs.query).mockImplementation(async (info: chrome.tabs.QueryInfo) => {
    const ids = byWindow[info.windowId ?? -1] ?? [];
    return ids.map(id => ({ id, windowId: info.windowId })) as chrome.tabs.Tab[];
  });
  vi.mocked(chrome.tabGroups.query).mockImplementation(async () => []);
}

describe('PortManager', () => {
  let connect: (port: FakePort) => void;
  let fireTabCreated: () => void;

  beforeEach(() => {
    vi.clearAllMocks();

    initPortManager();

    const connectCalls = vi.mocked(chrome.runtime.onConnect.addListener).mock.calls;
    connect = connectCalls[connectCalls.length - 1][0] as unknown as (port: FakePort) => void;

    const createdCalls = vi.mocked(chrome.tabs.onCreated.addListener).mock.calls;
    fireTabCreated = createdCalls[createdCalls.length - 1][0] as unknown as () => void;
  });

  it('sends a subscribing port its own window, not the last-focused one', async () => {
    mockWindows({ 1: [10, 11], 2: [20] });

    const port = fakePort();
    connect(port);
    port.emit({ type: 'subscribe', windowId: 2 });
    await vi.waitFor(() => expect(port.postMessage).toHaveBeenCalled());

    const message = port.postMessage.mock.calls[0][0];
    expect(message.windowId).toBe(2);
    expect(message.tabs.map((t: chrome.tabs.Tab) => t.id)).toEqual([20]);
  });

  it('gives each window’s panel its own tabs on broadcast', async () => {
    mockWindows({ 1: [10, 11], 2: [20] });

    const portA = fakePort();
    const portB = fakePort();
    connect(portA);
    connect(portB);
    portA.emit({ type: 'subscribe', windowId: 1 });
    portB.emit({ type: 'subscribe', windowId: 2 });
    await vi.waitFor(() => {
      expect(portA.postMessage).toHaveBeenCalled();
      expect(portB.postMessage).toHaveBeenCalled();
    });
    portA.postMessage.mockClear();
    portB.postMessage.mockClear();

    fireTabCreated();
    await vi.waitFor(() => {
      expect(portA.postMessage).toHaveBeenCalled();
      expect(portB.postMessage).toHaveBeenCalled();
    });

    expect(portA.postMessage.mock.calls[0][0].tabs.map((t: chrome.tabs.Tab) => t.id)).toEqual([10, 11]);
    expect(portB.postMessage.mock.calls[0][0].tabs.map((t: chrome.tabs.Tab) => t.id)).toEqual([20]);
  });

  it('does not broadcast to a port that has not said which window it is', async () => {
    mockWindows({ 1: [10] });

    const port = fakePort();
    connect(port);

    fireTabCreated();
    await Promise.resolve();

    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it('ignores connections that are not ours', () => {
    const port = fakePort('some-other-extension');
    connect(port);
    port.emit({ type: 'subscribe', windowId: 1 });
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it('stops broadcasting to a disconnected port', async () => {
    mockWindows({ 1: [10] });

    const port = fakePort();
    connect(port);
    port.emit({ type: 'subscribe', windowId: 1 });
    await vi.waitFor(() => expect(port.postMessage).toHaveBeenCalled());
    port.postMessage.mockClear();

    port.disconnect();
    fireTabCreated();
    await Promise.resolve();

    expect(port.postMessage).not.toHaveBeenCalled();
  });
});
