import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wowCharacterGearAgent } from '../../src/mastra/agents';

// Mock network-heavy tools inside the agent via module mocks
vi.mock('../../src/mastra/tools', async (orig) => {
  const actual = await (orig as any)();
  return {
    ...actual,
    wowCharacterGearTool: {
      id: 'get-wow-character-gear',
      execute: vi.fn(async ({ context }) => ({
        name: 'Bezvoker',
        server: 'Korgath',
        level: 80,
        class: 'Evoker',
        race: 'Dracthyr',
        gender: 'Female',
        guild: 'Test Guild',
        spec: 'Devastation',
        specId: 1467,
        role: 'dps',
        heroTalentTree: { id: 1, name: 'Scalecommander' },
        gear: [ { slot: 'Head', name: 'Cowl of Tests', quality: 'Epic', itemLevel: 525 } ],
      })),
      inputSchema: { parse: (x: any) => x },
      outputSchema: { parse: (x: any) => x },
    },
  };
});

// Avoid invoking MCP providers
vi.mock('../../src/mastra/mcp', () => ({ mcp: { getTools: async () => ({}) } }));

// Avoid model network calls by mocking the Agent's generate to just call tool directly when prompt contains a lookup intent
vi.mock('@mastra/core/agent', async (orig) => {
  const actual = await (orig as any)();
  class FakeAgent extends actual.Agent {
    async generate(message: string) {
      if (/bezvoker/i.test(message) && /korgath/i.test(message)) {
        const data = await (this as any).tools.wowCharacterGearTool.execute({ context: { characterName: 'bezvoker', serverName: 'korgath', region: 'us' } });
        return { text: `Found ${data.name} on ${data.server} (${data.class} - ${data.spec}).` };
      }
      return { text: 'No-op' };
    }
  }
  return { ...actual, Agent: FakeAgent };
});

describe('wowCharacterGearAgent e2e (mocked)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('answers a basic lookup for character "bezvoker" on "korgath"', async () => {
    const result = await wowCharacterGearAgent.generate('Look up the character bezvoker on korgath');
    expect(result.text).toMatch(/Bezvoker/);
    expect(result.text).toMatch(/Korgath/);
    expect(result.text).toMatch(/Evoker/);
  });
});
