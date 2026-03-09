import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extract } from '@extractus/article-extractor';
import { fetchUrlContentTool } from '../../src/mastra/tools';

vi.mock('@extractus/article-extractor', () => ({
  extract: vi.fn(),
}));

describe('fetchUrlContentTool', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns extracted content fields', async () => {
    (extract as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: 'Title',
      content: '<p>Hello</p>',
      author: 'Author',
      published: '2024-01-01',
      url: 'https://example.com',
    });

    const result = await fetchUrlContentTool.execute?.({ url: 'https://example.com' }, {});

    expect(result).toEqual({
      title: 'Title',
      content: '<p>Hello</p>',
      author: 'Author',
      published: '2024-01-01',
      url: 'https://example.com',
    });
  });

  it('gracefully handles extractor returning null/undefined', async () => {
    (extract as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await fetchUrlContentTool.execute?.({ url: 'https://nope.com' }, {});
    expect(result).toEqual({ error: 'Could not extract content.' });
  });

  it('returns error when extractor throws', async () => {
    (extract as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const result = await fetchUrlContentTool.execute?.({ url: 'https://explode.com' }, {});
    // Implementation catches extractor errors and returns a generic 'Could not extract content.'
    expect(result).toEqual({ error: 'Could not extract content.' });
  });

  it('returns generic extraction error on timeout-like failures', async () => {
    (extract as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ETIMEDOUT'));

    const result = await fetchUrlContentTool.execute?.({ url: 'https://slow.example.com' }, {});
    expect(result).toEqual({ error: 'Could not extract content.' });
  });

  it('rejects invalid URL input values', async () => {
    const result = await fetchUrlContentTool.execute?.({ url: 'notaurl' }, {});
    expect(result).toMatchObject({
      error: true,
      message: expect.stringContaining('Tool input validation failed for fetch-url-content'),
    });
  });
});
