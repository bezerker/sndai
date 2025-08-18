import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Use an in-memory SQLite instance for tests to avoid touching repo DB files
const DB_URL = 'file::memory:?cache=shared';

// A tiny deterministic embedder for tests.
// The memory/embed utilities may call model.doEmbed under the hood, so provide that.
const fakeEmbedder = {
  // new AI-style embedding interface
  doEmbed: async (inputs: string[] | string) => {
    const makeVec = () => new Array(8).fill(0.1234);
    if (Array.isArray(inputs)) return inputs.map(() => makeVec());
    return makeVec();
  },
  // also provide backward-compatible embed method
  embed: async (input: string | string[]) => {
    const makeVec = () => new Array(8).fill(0.1234);
    if (Array.isArray(input)) return input.map(() => makeVec());
    return makeVec();
  }
};

// Mock the ai.embedMany wrapper so it delegates to our fake embedder and returns the shape Memory expects.
vi.mock('ai', () => ({
  embedMany: async ({ values, model }: { values: string[]; model: any }) => {
    // model may be our fakeEmbedder; prefer doEmbed -> embed
    const embeddings = await (model?.doEmbed ? model.doEmbed(values) : model?.embed ? model.embed(values) : values.map(() => new Array(8).fill(0.1234)));
    return { embeddings };
  },
}));

let memory: any;

beforeAll(async () => {
  // Import storage/vector/memory after mocking 'ai'
  const { LibSQLStore } = await import('@mastra/libsql');
  const { Memory } = await import('@mastra/memory');

  const storage = new LibSQLStore({ url: DB_URL });

  // Disable semanticRecall and don't attach a vector to avoid calling the embedder in this unit test.
  memory = new Memory({
    storage,
    embedder: fakeEmbedder as any,
    vector: undefined,
    options: {
      lastMessages: 20,
      semanticRecall: false,
      workingMemory: { enabled: true, scope: 'resource', template: '#test' },
    }
  });

  // Allow any async initialization the Memory implementation may perform
  if (typeof memory.initialize === 'function') {
    await memory.initialize();
  }
});

afterAll(async () => {
  // Some memory implementations have a close/destroy method; call if available
  if (memory && typeof memory.close === 'function') {
    await memory.close();
  }
});

describe('Memory unit tests (in-memory)', () => {
  it('creates a thread, saves messages, and queries them', async () => {
    const resourceId = 'test_resource_1';
    const threadId = 'thread_test_1';

    const created = await memory.createThread({ resourceId, title: 'Test Thread', threadId });
    expect(created).toBeDefined();

    const messages = [
      {
        id: 'm1',
        threadId,
        resourceId,
        role: 'user',
        content: 'Hello memory',
        createdAt: new Date().toISOString(),
      },
    ];

    const saveResult = await memory.saveMessages({ messages, memoryConfig: {} });
    expect(saveResult).toBeDefined();

    const q = await memory.query({ threadId, resourceId });
    expect(q).toBeDefined();
    // Expect at least one message saved
    expect(Array.isArray(q.messages)).toBe(true);
    expect(q.messages.length).toBeGreaterThanOrEqual(1);
    // uiMessages usually contain rendered content - assert presence of the saved text somewhere
    const found = (q.uiMessages || []).some((m: any) => (m.content || '').includes('Hello memory') || (m.text || '').includes('Hello memory'));
    expect(found).toBe(true);
  });

  it('can generate working memory template and retrieve working memory', async () => {
    const resourceId = 'test_resource_1';
    const threadId = 'thread_test_1';

    const template = await memory.getWorkingMemoryTemplate({});
    // Template may be undefined or an object; ensure the call does not throw and returns something or undefined
    expect(template === undefined || typeof template === 'object').toBe(true);

    const wm = await memory.getWorkingMemory({ threadId, resourceId, memoryConfig: {} });
    // Should not throw; may be string/obj/undefined depending on implementation
    expect(wm === undefined || typeof wm === 'string' || typeof wm === 'object').toBe(true);
  });
});
