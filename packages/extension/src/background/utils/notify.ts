export function notify(title: string, message: string): void {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title,
      message,
    });
  } catch (err) {
    console.warn('Notification failed:', err);
  }
}
