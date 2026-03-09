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

  const storage = new LibSQLStore({ id: 'test-libsql', url: DB_URL });

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

    const q = await memory.recall({ threadId, resourceId });
    expect(q).toBeDefined();
    // Expect at least one message saved (v1 returns { messages } only)
    expect(Array.isArray(q.messages)).toBe(true);
    expect(q.messages.length).toBeGreaterThanOrEqual(1);
    const getText = (m: any) => {
      if (typeof m.content === 'string') return m.content;
      if (m.text) return m.text;
      if (Array.isArray(m.content)) return (m.content as any[]).map((p: any) => p.text || p.content || '').join('');
      if (m.content && typeof m.content === 'object') return JSON.stringify(m.content);
      return '';
    };
    const found = q.messages.some((m: any) => getText(m).includes('Hello memory'));
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

  it('keeps user data isolated across different resources', async () => {
    const userA = { resourceId: 'user_a', threadId: 'thread_a' };
    const userB = { resourceId: 'user_b', threadId: 'thread_b' };

    await memory.createThread({ resourceId: userA.resourceId, title: 'User A', threadId: userA.threadId });
    await memory.createThread({ resourceId: userB.resourceId, title: 'User B', threadId: userB.threadId });

    await memory.saveMessages({
      messages: [
        {
          id: 'ua-1',
          threadId: userA.threadId,
          resourceId: userA.resourceId,
          role: 'user',
          content: 'I main a mage on Area52',
          createdAt: new Date().toISOString(),
        },
      ],
      memoryConfig: {},
    });

    await memory.saveMessages({
      messages: [
        {
          id: 'ub-1',
          threadId: userB.threadId,
          resourceId: userB.resourceId,
          role: 'user',
          content: 'I main a warrior on Sargeras',
          createdAt: new Date().toISOString(),
        },
      ],
      memoryConfig: {},
    });

    const recallA = await memory.recall({ threadId: userA.threadId, resourceId: userA.resourceId });
    const recallB = await memory.recall({ threadId: userB.threadId, resourceId: userB.resourceId });

    const toJoinedText = (messages: any[]) => messages
      .map((m: any) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')))
      .join(' ')
      .toLowerCase();

    const textA = toJoinedText(recallA.messages || []);
    const textB = toJoinedText(recallB.messages || []);

    expect(textA).toContain('mage');
    expect(textA).not.toContain('warrior');
    expect(textB).toContain('warrior');
    expect(textB).not.toContain('mage');
  });

  it('enforces lastMessages cap in a limited-memory configuration', async () => {
    const { LibSQLStore } = await import('@mastra/libsql');
    const { Memory } = await import('@mastra/memory');

    const limitedMemory: any = new Memory({
      storage: new LibSQLStore({ id: 'test-libsql-limited', url: DB_URL }),
      embedder: fakeEmbedder as any,
      vector: undefined,
      options: {
        lastMessages: 3,
        semanticRecall: false,
        workingMemory: { enabled: false },
      },
    });

    if (typeof limitedMemory.initialize === 'function') {
      await limitedMemory.initialize();
    }

    const resourceId = 'limited_resource';
    const threadId = 'limited_thread';
    await limitedMemory.createThread({ resourceId, title: 'Limited', threadId });

    const now = Date.now();
    const messages = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id, idx) => ({
      id,
      threadId,
      resourceId,
      role: 'user' as const,
      content: `message-${idx + 1}`,
      createdAt: new Date(now + idx).toISOString(),
    }));

    await limitedMemory.saveMessages({ messages, memoryConfig: {} });
    const recall = await limitedMemory.recall({ threadId, resourceId });

    expect(Array.isArray(recall.messages)).toBe(true);
    expect((recall.messages || []).length).toBeLessThanOrEqual(3);

    if (typeof limitedMemory.close === 'function') {
      await limitedMemory.close();
    }
  });
});
