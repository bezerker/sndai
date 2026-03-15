import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalAgentMaxSteps = process.env.AGENT_MAX_STEPS;
const originalModelProvider = process.env.MODEL_PROVIDER;

function setupAgentModuleMocks() {
  vi.doMock('@ai-sdk/openai', () => ({
    createOpenAI: () => () => ({ provider: 'openai-mock' }),
  }));

  vi.doMock('ollama-ai-provider-v2', () => ({
    ollama: () => ({ provider: 'ollama-mock' }),
  }));

  vi.doMock('@mastra/core/agent', () => {
    class Agent {
      id: string;
      name: string;
      instructions: string;
      model: unknown;
      tools: unknown;
      memory: unknown;
      defaultGenerateOptions: unknown;

      constructor(config: any) {
        this.id = config.id;
        this.name = config.name;
        this.instructions = config.instructions;
        this.model = config.model;
        this.tools = config.tools;
        this.memory = config.memory;
        this.defaultGenerateOptions = config.defaultGenerateOptions;
      }
    }

    return { Agent };
  });

  vi.doMock('@mastra/memory', () => ({
    Memory: class {
      constructor(_config: unknown) {}
    },
  }));

  vi.doMock('@mastra/libsql', () => ({
    LibSQLVector: class {
      constructor(_config: unknown) {}
    },
  }));

  vi.doMock('@mastra/fastembed', () => ({
    fastembed: { id: 'fake-embedder' },
  }));

  vi.doMock('../../src/mastra/storage', () => ({
    storage: { id: 'fake-storage' },
  }));

  vi.doMock('../../src/mastra/mcp', () => ({
    mcp: {
      listTools: vi.fn().mockResolvedValue({}),
    },
  }));

  vi.doMock('../../src/mastra/tools', () => ({
    wowCharacterGearTool: { id: 'get-wow-character-gear' },
    webSearchTool: { id: 'web-search' },
    fetchUrlContentTool: { id: 'fetch-url-content' },
  }));

  vi.doMock('../../src/mastra/tools/bisTool', () => ({
    bisScraperTool: { id: 'bis.scrape' },
  }));
}

describe('agent configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalAgentMaxSteps === undefined) {
      delete process.env.AGENT_MAX_STEPS;
    } else {
      process.env.AGENT_MAX_STEPS = originalAgentMaxSteps;
    }

    if (originalModelProvider === undefined) {
      delete process.env.MODEL_PROVIDER;
    } else {
      process.env.MODEL_PROVIDER = originalModelProvider;
    }
  });

  it('parses AGENT_MAX_STEPS and applies it to defaultGenerateOptions', async () => {
    process.env.AGENT_MAX_STEPS = '7';
    process.env.MODEL_PROVIDER = 'openai';
    setupAgentModuleMocks();

    const agentsModule = await import('../../src/mastra/agents');
    const wowCharacterGearAgent = agentsModule.wowCharacterGearAgent as any;

    expect(agentsModule.agentMaxSteps).toBe(7);
    expect(wowCharacterGearAgent.defaultGenerateOptions).toEqual({ maxSteps: 7 });
  });

  it('includes key instruction guardrails in the system prompt', async () => {
    delete process.env.AGENT_MAX_STEPS;
    process.env.MODEL_PROVIDER = 'openai';
    setupAgentModuleMocks();

    const agentsModule = await import('../../src/mastra/agents');
    const instructions = String((agentsModule.wowCharacterGearAgent as any).instructions || '');

    expect(instructions).toMatch(/stay on world of warcraft topics/i);
    expect(instructions).toMatch(/do not provide bis by default/i);
    expect(instructions).toMatch(/current patch is 12\.0\.1/i);
    expect(instructions).toMatch(/privacy and scope/i);
  });
});
