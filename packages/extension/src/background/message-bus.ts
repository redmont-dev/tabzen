import type { MessageRequest, MessageAction, MessageHandler, MessageResponse } from '@/shared/messages';

export class MessageBus {
  private handlers = new Map<MessageAction, MessageHandler>();

  register<A extends MessageAction>(
    action: A,
    handler: MessageHandler<Extract<MessageRequest, { action: A }>>,
  ): void {
    if (this.handlers.has(action)) {
      throw new Error(`Handler for "${action}" already registered`);
    }
    this.handlers.set(action, handler as MessageHandler);
  }

  async dispatch(request: MessageRequest): Promise<MessageResponse> {
    const handler = this.handlers.get(request.action);
    if (!handler) {
      return { ok: false, error: `No handler for "${request.action}"` };
    }
    try {
      return await handler(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof Error) console.error(`MessageBus handler "${request.action}" failed:`, err);
      return { ok: false, error: message };
    }
  }

  listen(): void {
    chrome.runtime.onMessage.addListener(
      (request: unknown, _sender, sendResponse) => {
        if (!request || typeof request !== 'object' || typeof (request as Record<string, unknown>).action !== 'string') {
          sendResponse({ ok: false, error: 'Invalid request' });
          return;
        }
        this.dispatch(request as MessageRequest).then(sendResponse);
        return true;
      },
    );
  }
}
