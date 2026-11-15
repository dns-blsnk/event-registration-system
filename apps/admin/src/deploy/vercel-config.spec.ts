import { describe, expect, it } from 'vitest';

import vercelConfig from '../../vercel.json';

interface Header {
  key: string;
  value: string;
}

/** The API host, as the /api rewrite names it; every other mention must match it. */
function apiHost(): string {
  const destination = vercelConfig.rewrites[0]?.destination ?? '';
  return new URL(destination.replace('/:path*', '')).host;
}

function headerValue(key: string): string {
  const rule = vercelConfig.headers.find((entry) => entry.source === '/(.*)');
  const header = rule?.headers.find((entry: Header) => entry.key === key);
  if (header === undefined) throw new Error(`missing header ${key} on every route`);
  return header.value;
}

/** The CSP as a map of directive to its sources. */
function csp(): Map<string, string[]> {
  return new Map(
    headerValue('Content-Security-Policy')
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .map(([name = '', ...sources]) => [name, sources]),
  );
}

describe('vercel.json', () => {
  it('sends /api to the API on Render, before the single-page fallback', () => {
    const [api, fallback] = vercelConfig.rewrites;

    expect(api?.source).toBe('/api/:path*');
    expect(api?.destination).toBe(`https://${apiHost()}/api/:path*`);
    expect(fallback).toEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('builds the chat socket URL for the same API host the rewrite and CSP use', () => {
    expect(vercelConfig.buildCommand).toContain(`VITE_CHAT_URL=https://${apiHost()} `);
  });

  it('allows scripts only from the admin itself', () => {
    expect(csp().get('script-src')).toEqual(["'self'"]);
    expect(csp().get('object-src')).toEqual(["'none'"]);
  });

  it('allows the chat socket and API host, and banner images from R2, nothing broader', () => {
    expect(csp().get('connect-src')).toEqual([
      "'self'",
      `https://${apiHost()}`,
      `wss://${apiHost()}`,
    ]);
    expect(csp().get('img-src')).toEqual(["'self'", 'data:', 'https://*.r2.cloudflarestorage.com']);
  });

  it('cannot be framed by other sites', () => {
    expect(csp().get('frame-ancestors')).toEqual(["'none'"]);
    expect(headerValue('X-Frame-Options')).toBe('DENY');
  });

  it('sends the other security headers', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
    expect(headerValue('Strict-Transport-Security')).toContain('max-age=');
    expect(headerValue('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});
