import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { TabzenDB } from '../indexed-db';

describe('TabzenDB', () => {
  let db: TabzenDB;

  beforeEach(async () => {
    db = new TabzenDB(`tabzen-test-${Math.random()}`);
    await db.open();
  });

  it('puts and gets a session', async () => {
    const session = { id: 's1', name: 'Test', createdAt: Date.now() };
    await db.putSession(session as any);
    const result = await db.getSession('s1');
    expect(result?.name).toBe('Test');
  });

  it('lists all sessions', async () => {
    await db.putSession({ id: 's1', name: 'A', createdAt: 1 } as any);
    await db.putSession({ id: 's2', name: 'B', createdAt: 2 } as any);
    const sessions = await db.getAllSessions();
    expect(sessions).toHaveLength(2);
  });

  it('deletes a session', async () => {
    await db.putSession({ id: 's1', name: 'A', createdAt: 1 } as any);
    await db.deleteSession('s1');
    const result = await db.getSession('s1');
    expect(result).toBeUndefined();
  });

  it('puts and gets analytics snapshots', async () => {
    const snap = { timestamp: Date.now(), tabCount: 10, groupCount: 3 };
    await db.putAnalytics(snap as any);
    const results = await db.getAnalytics(0, Date.now() + 1000);
    expect(results).toHaveLength(1);
    expect(results[0].tabCount).toBe(10);
  });

  it('prunes analytics older than cutoff', async () => {
    await db.putAnalytics({ timestamp: 1000, tabCount: 5 } as any);
    await db.putAnalytics({ timestamp: 9000, tabCount: 10 } as any);
    await db.pruneAnalytics(5000);
    const results = await db.getAnalytics(0, 99999);
    expect(results).toHaveLength(1);
    expect(results[0].tabCount).toBe(10);
  });
});
