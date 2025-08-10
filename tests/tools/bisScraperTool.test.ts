import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bisScraperTool } from '../../src/mastra/tools/bisTool';
import { fetch } from 'undici';

vi.mock('undici', () => ({ fetch: vi.fn() }));

function htmlWithHeaderAndTable() {
  return `
  <html>
    <body>
      <h2>Overall BiS Gear</h2>
      <table>
        <tr><th>Slot</th><th>Item</th></tr>
        <tr><td>Head</td><td>Test Helm</td></tr>
        <tr><td>Chest</td><td>Test Chest</td></tr>
      </table>
    </body>
  </html>
  `;
}

describe('bisScraperTool', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requires a role or specId that resolves to a role', async () => {
    await expect(
      bisScraperTool.execute({ context: { spec: 'Devastation', cls: 'Evoker', specId: '', role: '' } } as any)
    ).rejects.toThrow(/Role could not be determined/);
  });

  it('auto-fills role from specId and scrapes table', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: async () => htmlWithHeaderAndTable(),
    } as any);

    const result = await bisScraperTool.execute({ context: { spec: 'Devastation', cls: 'Evoker', specId: '1467', role: '' } } as any);

    expect(result.role).toBe('dps');
    expect(result.bis).toEqual({ Head: 'Test Helm', Chest: 'Test Chest' });
    expect(result.source).toContain('icy-veins.com');
  });
});
