import { MessageBus } from './message-bus';
import { registerTabManager } from './services/tab-manager';
import { registerRuleEngine } from './services/rule-engine';
import { registerWorkspaceManager } from './services/workspace-manager';
import { registerSessionManager } from './services/session-manager';
import { registerSearchIndex } from './services/search-index';
import { registerAnalyticsCollector } from './services/analytics-collector';

const bus = new MessageBus();

registerTabManager(bus);
registerRuleEngine(bus);
registerWorkspaceManager(bus);
registerSessionManager(bus);
registerSearchIndex(bus);
registerAnalyticsCollector(bus);

bus.listen();
bus.register('ping', async () => ({ ok: true, data: 'pong' }));

console.log('Tabzen background service worker started');
