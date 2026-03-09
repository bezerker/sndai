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

function htmlWithHeaderNoTable() {
  return `
  <html>
    <body>
      <h2>Overall BiS Gear</h2>
      <div>No table here</div>
      <p>Still no table</p>
    </body>
  </html>
  `;
}

function htmlWithoutHeader() {
  return `
  <html>
    <body>
      <h2>Rotation Guide</h2>
      <table>
        <tr><th>Slot</th><th>Item</th></tr>
        <tr><td>Head</td><td>Not BiS</td></tr>
      </table>
    </body>
  </html>
  `;
}

function htmlWithHeaderAndNonSiblingTable() {
  return `
  <html>
    <body>
      <h2>Overall BiS Gear</h2>
      <section>
        <div>Context section</div>
      </section>
      <div>
        <table>
          <tr><th>Slot</th><th>Item</th></tr>
          <tr><td>Head</td><td>Fallback Helm</td></tr>
        </table>
      </div>
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
      bisScraperTool.execute?.({ spec: 'Devastation', cls: 'Evoker', specId: '', role: '' }, {})
    ).rejects.toThrow(/Role could not be determined/);
  });

  it('auto-fills role from specId and scrapes table', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: async () => htmlWithHeaderAndTable(),
    } as any);

    const result = await bisScraperTool.execute?.({ spec: 'Devastation', cls: 'Evoker', specId: '1467', role: '' }, {});

    expect(result.role).toBe('dps');
    expect(result.bis).toEqual({ Head: 'Test Helm', Chest: 'Test Chest' });
    expect(result.source).toContain('icy-veins.com');
  });

  it('throws when fetch fails (network error)', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));

    await expect(
      bisScraperTool.execute?.({ spec: 'Devastation', cls: 'Evoker', specId: '1467', role: '' }, {})
    ).rejects.toThrow(/network down/);
  });

  it('throws a clear error when BiS header cannot be found', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: async () => htmlWithoutHeader(),
    } as any);

    await expect(
      bisScraperTool.execute?.({ spec: 'Devastation', cls: 'Evoker', specId: '1467', role: '' }, {}),
    ).rejects.toThrow(/BiS header not found/);
  });

  it('throws a clear error when BiS table cannot be found', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: async () => htmlWithHeaderNoTable(),
    } as any);

    await expect(
      bisScraperTool.execute?.({ spec: 'Devastation', cls: 'Evoker', specId: '1467', role: '' }, {}),
    ).rejects.toThrow(/BiS table not found after header/);
  });

  it('uses DOM-order fallback when table is not direct sibling', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: async () => htmlWithHeaderAndNonSiblingTable(),
    } as any);

    const result = await bisScraperTool.execute?.(
      { spec: 'Devastation', cls: 'Evoker', specId: '1467', role: '' },
      {},
    );

    expect(result.bis).toEqual({ Head: 'Fallback Helm' });
  });

  it('throws when specId does not resolve to a role', async () => {
    await expect(
      bisScraperTool.execute?.({ spec: 'Devastation', cls: 'Evoker', specId: '999999', role: '' }, {}),
    ).rejects.toThrow(/Role could not be determined/);
  });
});
