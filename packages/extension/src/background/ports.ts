/**
 * Manages long-lived connections from UI pages (side panel, popup).
 * When tabs/groups change, broadcasts the updated window info to all
 * connected ports so UIs can refresh in real time.
 *
 * Each port declares which window it is showing. The service worker has no
 * "current window" of its own — chrome.windows.getCurrent() there resolves to
 * whichever window was last focused — so a panel must be told its own window
 * rather than having one inferred for it.
 */

import { PORT_NAME } from '@/shared/constants';

const portWindows = new Map<chrome.runtime.Port, number>();

interface SubscribeMessage {
  type: 'subscribe';
  windowId: number;
}

export function initPortManager(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAME) return;

    // Registered without a window until the UI says which one it is showing.
    portWindows.set(port, -1);

    port.onMessage.addListener((message: unknown) => {
      if (
        message &&
        typeof message === 'object' &&
        (message as SubscribeMessage).type === 'subscribe' &&
        typeof (message as SubscribeMessage).windowId === 'number'
      ) {
        portWindows.set(port, (message as SubscribeMessage).windowId);
        void sendWindowState(port, (message as SubscribeMessage).windowId);
      }
    });

    port.onDisconnect.addListener(() => {
      portWindows.delete(port);
    });
  });

  // Broadcast on tab events
  const broadcastUpdate = () => broadcast();

  chrome.tabs.onCreated.addListener(broadcastUpdate);
  chrome.tabs.onRemoved.addListener(broadcastUpdate);
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    // Only broadcast on meaningful changes
    if (changeInfo.title || changeInfo.url || changeInfo.groupId !== undefined || changeInfo.status === 'complete') {
      broadcast();
    }
  });
  chrome.tabs.onMoved.addListener(broadcastUpdate);

  // Note: chrome.tabGroups.onUpdated and onCreated are not available in MV3
  // Tab group changes are captured via tabs.onUpdated changeInfo.groupId
}

async function getWindowState(windowId: number) {
  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId }),
  ]);
  return { type: 'windowUpdate' as const, tabs, groups, windowId };
}

async function sendWindowState(port: chrome.runtime.Port, windowId: number): Promise<void> {
  try {
    port.postMessage(await getWindowState(windowId));
  } catch {
    // Port closed, or the window is gone
    portWindows.delete(port);
  }
}

async function broadcast(): Promise<void> {
  if (portWindows.size === 0) return;

  // Group ports by window so each window is queried once, however many panels
  // happen to be watching it.
  const byWindow = new Map<number, chrome.runtime.Port[]>();
  for (const [port, windowId] of portWindows) {
    if (windowId === -1) continue; // Not subscribed yet
    const ports = byWindow.get(windowId);
    if (ports) ports.push(port);
    else byWindow.set(windowId, [port]);
  }

  for (const [windowId, ports] of byWindow) {
    let message: Awaited<ReturnType<typeof getWindowState>>;
    try {
      message = await getWindowState(windowId);
    } catch {
      continue; // Window is closing
    }

    for (const port of ports) {
      try {
        port.postMessage(message);
      } catch {
        portWindows.delete(port);
      }
    }
  }
}
