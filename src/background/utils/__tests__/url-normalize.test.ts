import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../url-normalize';

describe('normalizeUrl', () => {
  it('returns the URL unchanged with no options', () => {
    const url = 'https://example.com/path#section';
    expect(normalizeUrl(url, {
      stripFragments: false,
      stripTrailingSlash: false,
      protocolAgnostic: false,
    })).toBe('https://example.com/path#section');
  });

  it('strips fragments when enabled', () => {
    expect(normalizeUrl('https://example.com/page#heading', {
      stripFragments: true,
      stripTrailingSlash: false,
      protocolAgnostic: false,
    })).toBe('https://example.com/page');
  });

  it('strips trailing slash when enabled', () => {
    expect(normalizeUrl('https://example.com/path/', {
      stripFragments: false,
      stripTrailingSlash: true,
      protocolAgnostic: false,
    })).toBe('https://example.com/path');
  });

  it('does not strip trailing slash from bare domain', () => {
    expect(normalizeUrl('https://example.com/', {
      stripFragments: false,
      stripTrailingSlash: true,
      protocolAgnostic: false,
    })).toBe('https://example.com/');
  });

  it('makes URL protocol-agnostic when enabled', () => {
    expect(normalizeUrl('https://example.com/page', {
      stripFragments: false,
      stripTrailingSlash: false,
      protocolAgnostic: true,
    })).toBe('//example.com/page');
  });

  it('makes http URL protocol-agnostic when enabled', () => {
    expect(normalizeUrl('http://example.com/page', {
      stripFragments: false,
      stripTrailingSlash: false,
      protocolAgnostic: true,
    })).toBe('//example.com/page');
  });

  it('applies all options together', () => {
    expect(normalizeUrl('http://example.com/docs/#intro', {
      stripFragments: true,
      stripTrailingSlash: true,
      protocolAgnostic: true,
    })).toBe('//example.com/docs');
  });

  it('handles URLs without fragments gracefully', () => {
    expect(normalizeUrl('https://example.com/page', {
      stripFragments: true,
      stripTrailingSlash: false,
      protocolAgnostic: false,
    })).toBe('https://example.com/page');
  });

  it('handles non-http URLs without stripping protocol', () => {
    expect(normalizeUrl('chrome://extensions/', {
      stripFragments: false,
      stripTrailingSlash: false,
      protocolAgnostic: true,
    })).toBe('chrome://extensions/');
  });
});
