import { describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/auth', () => ({
  handlers: {
    GET: mockGet,
    POST: mockPost,
  },
}));

describe('NextAuth route exports', () => {
  it('re-exports GET and POST handlers from auth', async () => {
    const routeModule = await import('./route');

    expect(routeModule.GET).toBe(mockGet);
    expect(routeModule.POST).toBe(mockPost);
  });
});
