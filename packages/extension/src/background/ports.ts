/**
 * Manages long-lived connections from UI pages (side panel, popup).
 * When tabs/groups change, broadcasts the updated window info to all
 * connected ports so UIs can refresh in real time.
 */

const connectedPorts = new Set<chrome.runtime.Port>();

export function initPortManager(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'tabzen-ui') return;

    connectedPorts.add(port);

    port.onDisconnect.addListener(() => {
      connectedPorts.delete(port);
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

async function broadcast(): Promise<void> {
  if (connectedPorts.size === 0) return;

  try {
    const window = await chrome.windows.getCurrent();
    const [tabs, groups] = await Promise.all([
      chrome.tabs.query({ windowId: window.id }),
      chrome.tabGroups.query({ windowId: window.id }),
    ]);

    const message = {
      type: 'windowUpdate' as const,
      tabs,
      groups,
      windowId: window.id,
    };

    for (const port of connectedPorts) {
      try {
        port.postMessage(message);
      } catch {
        connectedPorts.delete(port);
      }
    }
  } catch {
    // Window might be closing
  }
}
