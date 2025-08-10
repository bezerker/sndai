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

    const results = await webSearchTool.execute({ context: { query: 'wow', limit: 2 } } as any);

    expect(results).toEqual([
      { title: 'A', link: 'https://a.com', snippet: 'a' },
      { title: 'B', link: 'https://b.com', snippet: 'b' },
    ]);
  });
});
