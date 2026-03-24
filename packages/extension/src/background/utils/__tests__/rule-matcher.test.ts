import { describe, it, expect } from 'vitest';
import { matchRule, matchRules, extractDomain } from '../rule-matcher';
import type { GroupingRule } from '@/data/types';

const makeRule = (overrides: Partial<GroupingRule> & Pick<GroupingRule, 'type' | 'pattern'>): GroupingRule => ({
  id: 'r1',
  groupName: 'Test',
  color: 'blue',
  enabled: true,
  source: 'user',
  ...overrides,
});

describe('matchRule', () => {
  describe('prefix matching', () => {
    it('matches a URL that starts with the pattern', () => {
      const rule = makeRule({ type: 'prefix', pattern: 'https://github.com/anthropics' });
      expect(matchRule('https://github.com/anthropics/claude', rule)).toBe(true);
    });

    it('does not match a URL that does not start with the pattern', () => {
      const rule = makeRule({ type: 'prefix', pattern: 'https://github.com/anthropics' });
      expect(matchRule('https://gitlab.com/anthropics/repo', rule)).toBe(false);
    });
  });

  describe('domain matching', () => {
    it('matches exact domain', () => {
      const rule = makeRule({ type: 'domain', pattern: 'github.com' });
      expect(matchRule('https://github.com/anthropics/claude', rule)).toBe(true);
    });

    it('matches subdomain with wildcard pattern', () => {
      const rule = makeRule({ type: 'domain', pattern: '*.figma.com' });
      expect(matchRule('https://www.figma.com/file/abc', rule)).toBe(true);
    });

    it('does not match different domain', () => {
      const rule = makeRule({ type: 'domain', pattern: 'github.com' });
      expect(matchRule('https://gitlab.com/repo', rule)).toBe(false);
    });

    it('wildcard pattern matches the base domain itself', () => {
      const rule = makeRule({ type: 'domain', pattern: '*.figma.com' });
      expect(matchRule('https://figma.com/files', rule)).toBe(true);
    });

    it('does not match a superdomain', () => {
      const rule = makeRule({ type: 'domain', pattern: 'docs.google.com' });
      expect(matchRule('https://google.com/search', rule)).toBe(false);
    });
  });

  describe('regex matching', () => {
    it('matches a regex pattern', () => {
      const rule = makeRule({ type: 'regex', pattern: 'https://.*\\.google\\.com/.*' });
      expect(matchRule('https://docs.google.com/spreadsheets/d/abc', rule)).toBe(true);
    });

    it('does not match when regex does not match', () => {
      const rule = makeRule({ type: 'regex', pattern: '^https://github\\.com/anthropics' });
      expect(matchRule('https://github.com/openai/repo', rule)).toBe(false);
    });

    it('returns false for invalid regex', () => {
      const rule = makeRule({ type: 'regex', pattern: '[invalid(' });
      expect(matchRule('https://example.com', rule)).toBe(false);
    });
  });

  it('returns false for disabled rules', () => {
    const rule = makeRule({ type: 'prefix', pattern: 'https://github.com', enabled: false });
    expect(matchRule('https://github.com/repo', rule)).toBe(false);
  });
});

describe('matchRules', () => {
  it('returns null when no rules match', () => {
    const rules = [makeRule({ type: 'prefix', pattern: 'https://gitlab.com' })];
    expect(matchRules('https://github.com/repo', rules)).toBeNull();
  });

  it('returns the matching rule', () => {
    const rules = [
      makeRule({ id: 'r1', type: 'prefix', pattern: 'https://gitlab.com' }),
      makeRule({ id: 'r2', type: 'prefix', pattern: 'https://github.com' }),
    ];
    expect(matchRules('https://github.com/repo', rules)?.id).toBe('r2');
  });

  it('uses longest-match-wins for prefix rules', () => {
    const rules = [
      makeRule({ id: 'short', type: 'prefix', pattern: 'https://github.com', groupName: 'GitHub' }),
      makeRule({ id: 'long', type: 'prefix', pattern: 'https://github.com/anthropics', groupName: 'Anthropic' }),
    ];
    expect(matchRules('https://github.com/anthropics/claude', rules)?.id).toBe('long');
  });

  it('prefers prefix longest-match over domain match', () => {
    const rules = [
      makeRule({ id: 'domain', type: 'domain', pattern: 'github.com', groupName: 'GitHub' }),
      makeRule({ id: 'prefix', type: 'prefix', pattern: 'https://github.com/anthropics', groupName: 'Anthropic' }),
    ];
    expect(matchRules('https://github.com/anthropics/claude', rules)?.id).toBe('prefix');
  });

  it('returns first matching non-prefix rule when no prefix matches', () => {
    const rules = [
      makeRule({ id: 'r1', type: 'domain', pattern: 'github.com' }),
      makeRule({ id: 'r2', type: 'regex', pattern: '.*github.*' }),
    ];
    expect(matchRules('https://github.com/repo', rules)?.id).toBe('r1');
  });

  it('skips disabled rules', () => {
    const rules = [
      makeRule({ id: 'r1', type: 'prefix', pattern: 'https://github.com', enabled: false }),
      makeRule({ id: 'r2', type: 'domain', pattern: 'github.com', enabled: true }),
    ];
    expect(matchRules('https://github.com/repo', rules)?.id).toBe('r2');
  });
});

describe('extractDomain', () => {
  it('extracts domain from https URL', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
  });

  it('extracts domain from http URL', () => {
    expect(extractDomain('http://example.com')).toBe('example.com');
  });

  it('returns null for non-http URLs', () => {
    expect(extractDomain('chrome://extensions')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(extractDomain('not a url')).toBeNull();
  });
});
