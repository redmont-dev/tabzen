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
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  listen(): void {
    chrome.runtime.onMessage.addListener(
      (request: MessageRequest, _sender, sendResponse) => {
        this.dispatch(request).then(sendResponse);
        return true;
      },
    );
  }
}
