import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { TabzenDB } from '../indexed-db';
import type { Session, AnalyticsSnapshot } from '../types';

const stubSession = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  name: 'Test',
  workspaceId: null,
  createdAt: Date.now(),
  source: 'manual',
  tabs: [],
  groups: [],
  driveFileId: null,
  ...overrides,
});

const stubSnapshot = (overrides: Partial<AnalyticsSnapshot> = {}): AnalyticsSnapshot => ({
  timestamp: Date.now(),
  tabCount: 0,
  groupCount: 0,
  workspaceId: 'default',
  topDomains: [],
  duplicatesBlocked: 0,
  sessionsUsed: 0,
  ...overrides,
});

describe('TabzenDB', () => {
  let db: TabzenDB;

  beforeEach(async () => {
    db = new TabzenDB(`tabzen-test-${Math.random()}`);
    await db.open();
  });

  it('puts and gets a session', async () => {
    await db.putSession(stubSession({ id: 's1', name: 'Test' }));
    const result = await db.getSession('s1');
    expect(result?.name).toBe('Test');
  });

  it('lists all sessions', async () => {
    await db.putSession(stubSession({ id: 's1', name: 'A', createdAt: 1 }));
    await db.putSession(stubSession({ id: 's2', name: 'B', createdAt: 2 }));
    const sessions = await db.getAllSessions();
    expect(sessions).toHaveLength(2);
  });

  it('deletes a session', async () => {
    await db.putSession(stubSession({ id: 's1', name: 'A', createdAt: 1 }));
    await db.deleteSession('s1');
    const result = await db.getSession('s1');
    expect(result).toBeUndefined();
  });

  it('puts and gets analytics snapshots', async () => {
    await db.putAnalytics(stubSnapshot({ tabCount: 10, groupCount: 3 }));
    const results = await db.getAnalytics(0, Date.now() + 1000);
    expect(results).toHaveLength(1);
    expect(results[0].tabCount).toBe(10);
  });

  it('prunes analytics older than cutoff', async () => {
    await db.putAnalytics(stubSnapshot({ timestamp: 1000, tabCount: 5 }));
    await db.putAnalytics(stubSnapshot({ timestamp: 9000, tabCount: 10 }));
    await db.pruneAnalytics(5000);
    const results = await db.getAnalytics(0, 99999);
    expect(results).toHaveLength(1);
    expect(results[0].tabCount).toBe(10);
  });
});
