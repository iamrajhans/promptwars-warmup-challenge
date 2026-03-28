import { describe, it, expect, vi } from 'vitest';
import { authConfig } from '../lib/auth/config';
import { NextRequest } from 'next/server';

describe('Auth Configuration - authorized callback', () => {
  const authorized = authConfig.callbacks?.authorized;

  if (typeof authorized !== 'function') {
    throw new Error('Authorized callback is not a function');
  }

  // Helper to mock the context for the authorized callback
  const createCtx = (pathname: string, auth: unknown = null, headers: Record<string, string> = {}) => ({
    auth,
    request: {
      nextUrl: { pathname } as unknown as URL,
      headers: { get: (name: string) => headers[name] || null } as unknown as Headers,
      url: `http://localhost${pathname}`
    } as unknown as NextRequest
  });

  it('should allow access to public routes without authentication', () => {
    const ctx = createCtx('/', null);
    const result = authorized(ctx as unknown as Parameters<NonNullable<typeof authorized>>[0]);
    expect(result).toBe(true);
  });

  it('should redirect unauthenticated users from /operator', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const ctx = createCtx('/operator', null);
    const result = authorized(ctx as unknown as Parameters<NonNullable<typeof authorized>>[0]);
    expect(result).toBe(false);
    vi.unstubAllEnvs();
  });

  it('should allow authenticated users to access /operator', () => {
    const ctx = createCtx('/operator', { user: { name: 'Admin' }, expires: '' });
    const result = authorized(ctx as unknown as Parameters<NonNullable<typeof authorized>>[0]);
    expect(result).toBe(true);
  });

  it('should allow Playwright bypass via header', () => {
    const ctx = createCtx('/operator', null, { 'x-playwright-test': 'true' });
    const result = authorized(ctx as unknown as Parameters<NonNullable<typeof authorized>>[0]);
    expect(result).toBe(true);
  });

  it('should allow bypass if NODE_ENV is test', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const ctx = createCtx('/operator', null);
    const result = authorized(ctx as unknown as Parameters<NonNullable<typeof authorized>>[0]);
    expect(result).toBe(true);
    vi.unstubAllEnvs();
  });
});
