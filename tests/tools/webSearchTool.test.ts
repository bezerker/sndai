import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as googleSr from 'google-sr';
import { webSearchTool } from '../../src/mastra/tools';

vi.mock('google-sr', () => ({
  search: vi.fn(),
}));

describe('webSearchTool', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns top N formatted results', async () => {
    (googleSr.search as any).mockResolvedValue([
      { title: 'A', link: 'https://a.com', description: 'a' },
      { title: 'B', link: 'https://b.com', description: 'b' },
      { title: 'C', link: 'https://c.com', description: 'c' },
    ]);

    const results = await webSearchTool.execute?.({ query: 'wow', limit: 2 }, {});

    expect(results).toEqual([
      { title: 'A', link: 'https://a.com', snippet: 'a' },
      { title: 'B', link: 'https://b.com', snippet: 'b' },
    ]);
  });

  it('returns empty array when search yields no results', async () => {
    (googleSr.search as any).mockResolvedValue([]);
    const results = await webSearchTool.execute?.({ query: 'unlikely-query-xyz', limit: 5 }, {});
    expect(results).toEqual([]);
  });

  it('handles limit greater than available results', async () => {
    (googleSr.search as any).mockResolvedValue([
      { title: 'OnlyOne', link: 'https://one.com', description: 'one' }
    ]);
    const results = await webSearchTool.execute?.({ query: 'wow', limit: 5 }, {});
    expect(results).toEqual([{ title: 'OnlyOne', link: 'https://one.com', snippet: 'one' }]);
  });

  it('propagates underlying search errors', async () => {
    (googleSr.search as any).mockRejectedValue(new Error('rate limited'));

    await expect(
      webSearchTool.execute?.({ query: 'wow patch notes', limit: 5 }, {}),
    ).rejects.toThrow(/rate limited/);
  });

  it('rejects invalid limit values below minimum', async () => {
    const result = await webSearchTool.execute?.({ query: 'wow', limit: 0 }, {});
    expect(result).toMatchObject({
      error: true,
      message: expect.stringContaining('Tool input validation failed for web-search'),
    });
  });

  it('rejects invalid limit values above maximum', async () => {
    const result = await webSearchTool.execute?.({ query: 'wow', limit: 11 }, {});
    expect(result).toMatchObject({
      error: true,
      message: expect.stringContaining('Tool input validation failed for web-search'),
    });
  });
});
