import type { GroupingRule } from '@/data/types';

/**
 * Extract hostname from a URL. Returns null for non-http(s) or invalid URLs.
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Test whether a single rule matches the given URL.
 */
export function matchRule(url: string, rule: GroupingRule): boolean {
  if (!rule.enabled) return false;

  switch (rule.type) {
    case 'prefix':
      return url.startsWith(rule.pattern);

    case 'domain': {
      const hostname = extractDomain(url);
      if (!hostname) return false;
      const pattern = rule.pattern;

      if (pattern.startsWith('*.')) {
        // Wildcard domain: match the base domain and any subdomain
        const baseDomain = pattern.slice(2);
        return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
      }
      return hostname === pattern;
    }

    case 'regex': {
      try {
        return new RegExp(rule.pattern).test(url);
      } catch {
        return false;
      }
    }

    default:
      return false;
  }
}

/**
 * Find the best matching rule for a URL.
 * Prefix rules use longest-match-wins. Among all matching prefix rules, the one
 * with the longest pattern wins. If no prefix matches, the first matching
 * domain/regex rule (in array order) is returned.
 */
export function matchRules(url: string, rules: GroupingRule[]): GroupingRule | null {
  let bestPrefix: GroupingRule | null = null;
  let bestPrefixLen = 0;
  let firstNonPrefix: GroupingRule | null = null;

  for (const rule of rules) {
    if (!matchRule(url, rule)) continue;

    if (rule.type === 'prefix') {
      if (rule.pattern.length > bestPrefixLen) {
        bestPrefix = rule;
        bestPrefixLen = rule.pattern.length;
      }
    } else if (!firstNonPrefix) {
      firstNonPrefix = rule;
    }
  }

  // Prefix rules win over domain/regex when they match
  if (bestPrefix) return bestPrefix;
  return firstNonPrefix;
}
