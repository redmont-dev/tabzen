export interface NormalizeOptions {
  stripFragments: boolean;
  stripTrailingSlash: boolean;
  protocolAgnostic: boolean;
}

export function normalizeUrl(url: string, options: NormalizeOptions): string {
  let result = url;

  if (options.stripFragments) {
    const hashIndex = result.indexOf('#');
    if (hashIndex !== -1) {
      result = result.slice(0, hashIndex);
    }
  }

  if (options.stripTrailingSlash) {
    // Only strip if there's a path beyond the domain root
    const protocolEnd = result.indexOf('://');
    if (protocolEnd !== -1) {
      const afterProtocol = result.slice(protocolEnd + 3);
      const hasPath = afterProtocol.indexOf('/') !== -1;
      if (hasPath && result.endsWith('/')) {
        const stripped = result.slice(0, -1);
        // Don't strip if we'd be left with just the domain (e.g., "https://example.com")
        const afterProtocolStripped = stripped.slice(protocolEnd + 3);
        if (afterProtocolStripped.includes('/')) {
          result = stripped;
        }
      }
    }
  }

  if (options.protocolAgnostic) {
    if (result.startsWith('https://')) {
      result = '//' + result.slice('https://'.length);
    } else if (result.startsWith('http://')) {
      result = '//' + result.slice('http://'.length);
    }
    // Non-http protocols (chrome://, file://) are left as-is
  }

  return result;
}
