import { describe, it, expect, vi } from 'vitest';
import { authConfig } from '../lib/auth/config';

describe('Auth Configuration - authorized callback', () => {
  const authorized = authConfig.callbacks?.authorized;

  if (typeof authorized !== 'function') {
    throw new Error('Authorized callback is not a function');
  }

  it('should allow access to public routes without authentication', () => {
    const result = authorized({
      auth: null,
      request: { 
        nextUrl: { pathname: '/' } as any,
        headers: { get: () => null } as any
      } as any
    });
    expect(result).toBe(true);
  });

  it('should redirect unauthenticated users from /operator', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = authorized({
      auth: null,
      request: { 
        next_url: { pathname: '/operator' } as any,
        url: 'http://localhost/operator',
        nextUrl: { pathname: '/operator' } as any,
        headers: { get: () => null } as any
      } as any
    });
    expect(result).toBe(false);
    vi.unstubAllEnvs();
  });

  it('should allow authenticated users to access /operator', () => {
    const result = authorized({
      auth: { user: { name: 'Admin' }, expires: '' },
      request: { 
        nextUrl: { pathname: '/operator' } as any,
        headers: { get: () => null } as any
      } as any
    });
    expect(result).toBe(true);
  });

  it('should allow Playwright bypass via header', () => {
    const result = authorized({
      auth: null,
      request: { 
        nextUrl: { pathname: '/operator' } as any,
        headers: { get: (name: string) => name === 'x-playwright-test' ? 'true' : null } as any
      } as any
    });
    expect(result).toBe(true);
  });

  it('should allow bypass if NODE_ENV is test', () => {
    vi.stubEnv('NODE_ENV', 'test');
    
    const result = authorized({
      auth: null,
      request: { 
        nextUrl: { pathname: '/operator' } as any,
        headers: { get: () => null } as any
      } as any
    });
    
    expect(result).toBe(true);
    vi.unstubAllEnvs();
  });
});
