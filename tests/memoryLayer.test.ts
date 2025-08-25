import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory mock for storage
type MockResource = { workingMemory?: string | null; metadata?: any };
const resources = new Map<string, MockResource>();

vi.mock('../src/mastra/storage.ts', () => {
  return {
    storage: {
      getResourceById: vi.fn(async ({ resourceId }: { resourceId: string }) => {
        const r = resources.get(resourceId);
        if (!r) return null;
        return {
          id: resourceId,
          workingMemory: r.workingMemory ?? null,
          metadata: r.metadata ?? {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
      updateResource: vi.fn(async ({ resourceId, workingMemory, metadata }: { resourceId: string; workingMemory?: string; metadata?: Record<string, unknown> }) => {
        const existing = resources.get(resourceId) || { workingMemory: null, metadata: {} };
        const next: MockResource = {
          workingMemory: workingMemory !== undefined ? workingMemory : existing.workingMemory ?? null,
          metadata: { ...(existing.metadata || {}), ...(metadata || {}) },
        };
        resources.set(resourceId, next);
        return { id: resourceId, ...next, createdAt: new Date(), updatedAt: new Date() } as any;
      }),
    },
  };
});

// Import after mocks
const memoryLayer = await import('../src/mastra/memoryLayer.ts');

describe('memoryLayer helpers', () => {
  beforeEach(() => {
    resources.clear();
  });

  it('prepareLayeredMemory builds resource/thread and system context with user+scopes', async () => {
    // Seed user profile
    resources.set('discord:user:U123', {
      metadata: {
        type: 'user',
        aliases: ['Bez'],
        aliasesByGuild: { G999: ['B'] },
        charactersByGuild: {
          G999: [
            { name: 'Bezvoker', realm: 'korgath', region: 'US', class: 'Evoker', spec: 'Devastation', role: 'dps' },
          ],
        },
        blizzardBattleTag: 'Bez#1234',
      },
    });

    // Seed guild/channel rolling memories
    resources.set('discord:guild:G999', {
      metadata: { type: 'guild', rollingSummary: 'Guild sum', topics: ['raid'], expiresAt: new Date(Date.now() + 3600_000).toISOString() },
    });
    resources.set('discord:channel:C777', {
      metadata: { type: 'channel', rollingSummary: 'Channel sum', topics: ['mythic+'], expiresAt: new Date(Date.now() + 3600_000).toISOString() },
    });

    const message: any = {
      author: { id: 'U123' },
      guild: { id: 'G999' },
      channel: { id: 'C777', isThread: () => false },
    };

    const result = await memoryLayer.prepareLayeredMemory(message);
    expect(result.memory.resource).toBe('discord:user:U123');
    expect(result.memory.thread).toBe('discord:G999:C777:u:U123');
    const system = result.context[0];
    expect(system.role).toBe('system');
    const text = String((system as any).content);
    expect(text).toContain('User Profile');
    expect(text).toContain('Aliases');
    expect(text).toContain('WoW Characters');
    expect(text).toContain('Guild Context');
    expect(text).toContain('Channel Context');
    expect(text.toLowerCase()).toContain('mythic+');
    expect(text.toLowerCase()).toContain('raid');
  });

  it('rememberAfterResponse updates guild and channel rolling memory with topics and TTL', async () => {
    const message: any = {
      author: { id: 'U123' },
      guild: { id: 'G999' },
      channel: { id: 'C777', isThread: () => false },
    };

    await memoryLayer.rememberAfterResponse(
      message,
      'I prefer Mythic+ and BiS for my rogue',
      'Sure, here are BiS pointers.'
    );

    const guildRes = resources.get('discord:guild:G999')!;
    const chanRes = resources.get('discord:channel:C777')!;

    for (const res of [guildRes, chanRes]) {
      expect(res?.metadata?.rollingSummary).toBeDefined();
      const sum = String(res.metadata.rollingSummary);
      expect(sum).toContain('User: I prefer Mythic+ and BiS for my rogue');
      expect(sum).toContain('Assistant: Sure, here are BiS pointers.');
      const topics = res.metadata.topics as string[];
      expect(topics).toEqual(expect.arrayContaining(['mythic+', 'bis', 'rogue']));
      const exp = new Date(res.metadata.expiresAt).getTime();
      expect(exp).toBeGreaterThan(Date.now());
    }
  });

  it('handles thread scope for context and updates', async () => {
    const message: any = {
      author: { id: 'U1' },
      guild: { id: 'G1' },
      channel: { id: 'T1', isThread: () => true },
    };

    // Ensure prepare includes thread (will be empty initially)
    const prepared = await memoryLayer.prepareLayeredMemory(message);
    expect(prepared.memory.thread).toBe('discord:G1:T1:u:U1');

    await memoryLayer.rememberAfterResponse(message, 'Thread talks Mythic+', 'ack');
    const threadRes = resources.get('discord:thread:T1')!;
    expect(threadRes?.metadata?.rollingSummary).toContain('User: Thread talks Mythic+');
    expect((threadRes.metadata.topics as string[])).toEqual(expect.arrayContaining(['mythic+']));
  });

  it('includes reply context from referenced message (user reply)', async () => {
    const message: any = {
      author: { id: 'U10' },
      guild: { id: 'G10' },
      channel: { id: 'C10', isThread: () => false },
      client: { user: { id: 'BOT1' } },
      reference: { messageId: 'M123' },
      fetchReference: vi.fn(async () => ({
        id: 'M123',
        content: 'Original question about rogue BiS on Sargeras',
        author: { id: 'U10', username: 'SameUser' },
      })),
    };

    const prepared = await memoryLayer.prepareLayeredMemory(message);
    // Should include a reply context message
    const replyCtx = prepared.context.find((m: any) => String(m.content || '').includes('[Reply Context]')) as any;
    expect(replyCtx).toBeDefined();
    expect(replyCtx.role).toBe('user');
    expect(String(replyCtx.content)).toContain('rogue BiS');
  });

  it('includes reply context from referenced message (bot reply -> assistant role)', async () => {
    const message: any = {
      author: { id: 'U11' },
      guild: { id: 'G11' },
      channel: { id: 'C11', isThread: () => false },
      client: { user: { id: 'BOT42' } },
      reference: { messageId: 'M456' },
      fetchReference: vi.fn(async () => ({
        id: 'M456',
        content: 'Here are BiS recommendations for Rogue Mythic+',
        author: { id: 'BOT42' },
      })),
    };

    const prepared = await memoryLayer.prepareLayeredMemory(message);
    const replyCtx = prepared.context.find((m: any) => String(m.content || '').includes('[Reply Context]')) as any;
    expect(replyCtx).toBeDefined();
    expect(replyCtx.role).toBe('assistant');
    expect(String(replyCtx.content)).toContain('BiS recommendations');
  });

  it('includes third‑party reply context as system with caution', async () => {
    const message: any = {
      author: { id: 'U20' },
      guild: { id: 'G20' },
      channel: { id: 'C20', isThread: () => false },
      client: { user: { id: 'BOT99' } },
      reference: { messageId: 'M789' },
      fetchReference: vi.fn(async () => ({
        id: 'M789',
        content: 'I play a rogue on Sargeras and prefer Mythic+',
        author: { id: 'U21', username: 'AnotherUser' },
      })),
    };

    const prepared = await memoryLayer.prepareLayeredMemory(message);
    const replyCtx = prepared.context.find((m: any) => String(m.content || '').includes('[Third‑party Reply Context')) as any;
    expect(replyCtx).toBeDefined();
    expect(replyCtx.role).toBe('system');
    const text = String(replyCtx.content);
    expect(text).toContain('AnotherUser');
    expect(text.toLowerCase()).toContain('topical context only');
  });

  it('user helpers add alias and character bindings (deduped)', async () => {
    await memoryLayer.addUserAlias('U2', 'Bez', 'G2');
    await memoryLayer.addUserAlias('U2', 'Bez', 'G2'); // duplicate
    await memoryLayer.bindCharacterToUser('U2', 'G2', { name: 'Magebe', realm: 'Area52', region: 'US' });
    await memoryLayer.bindCharacterToUser('U2', 'G2', { name: 'Magebe', realm: 'Area52', region: 'US' }); // duplicate

    const prof = await memoryLayer.getUserProfile('U2', 'G2');
    expect(prof.aliases).toEqual(['Bez']);
    expect(prof.characters.length).toBe(1);
    expect(prof.characters[0]).toMatchObject({ name: 'Magebe', realm: 'Area52', region: 'US' });
  });

  it('merges global and guild aliases for user profile', async () => {
    await memoryLayer.addUserAlias('U4', 'BezGlobal');
    await memoryLayer.addUserAlias('U4', 'BezGuild', 'G4');
    const prof = await memoryLayer.getUserProfile('U4', 'G4');
    expect(prof.aliases).toEqual(expect.arrayContaining(['BezGlobal', 'BezGuild']));
  });

  it('expired scope memory is ignored in system context', async () => {
    resources.set('discord:user:U3', { metadata: { type: 'user', aliases: ['A'] } });
    resources.set('discord:channel:C3', { metadata: { type: 'channel', rollingSummary: 'stale', topics: ['raid'], expiresAt: new Date(Date.now() - 10_000).toISOString() } });
    const message: any = { author: { id: 'U3' }, guild: { id: 'G3' }, channel: { id: 'C3', isThread: () => false } };
    const pre = await memoryLayer.prepareLayeredMemory(message);
    const text = pre.context[0] ? String((pre.context[0] as any).content) : '';
    expect(text).not.toContain('stale');
  });

  it('respects summary max length env when re-imported', async () => {
    const prev = process.env.MEMORY_SCOPE_SUMMARY_MAX_CHARS;
    try {
      // ensure fresh import picks up env
      process.env.MEMORY_SCOPE_SUMMARY_MAX_CHARS = '50';
      await vi.resetModules();
      await vi.doMock('../src/mastra/storage.ts', () => ({
        storage: {
          getResourceById: vi.fn(async ({ resourceId }: { resourceId: string }) => {
            const r = resources.get(resourceId);
            if (!r) return null;
            return { id: resourceId, workingMemory: r.workingMemory ?? null, metadata: r.metadata ?? {}, createdAt: new Date(), updatedAt: new Date() } as any;
          }),
          updateResource: vi.fn(async ({ resourceId, workingMemory, metadata }: { resourceId: string; workingMemory?: string; metadata?: Record<string, unknown> }) => {
            const existing = resources.get(resourceId) || { workingMemory: null, metadata: {} };
            const next: MockResource = { workingMemory: workingMemory !== undefined ? workingMemory : existing.workingMemory ?? null, metadata: { ...(existing.metadata || {}), ...(metadata || {}) } };
            resources.set(resourceId, next);
            return { id: resourceId, ...next, createdAt: new Date(), updatedAt: new Date() } as any;
          }),
        },
      }));

      const ml = await import('../src/mastra/memoryLayer.ts');
      const message: any = { author: { id: 'U5' }, guild: { id: 'G5' }, channel: { id: 'C5', isThread: () => false } };
      const longUser = 'U'.repeat(200);
      const longBot = 'A'.repeat(200);
      await ml.rememberAfterResponse(message, longUser, longBot);
      const chanRes = resources.get('discord:channel:C5')!;
      const sum = String(chanRes.metadata.rollingSummary);
      expect(sum.length).toBeLessThanOrEqual(50);
    } finally {
      process.env.MEMORY_SCOPE_SUMMARY_MAX_CHARS = prev;
      await vi.resetModules();
    }
  });

  it('uses channel TTL env override when re-imported', async () => {
    const prev = process.env.MEMORY_CHANNEL_TTL_MINUTES;
    try {
      process.env.MEMORY_CHANNEL_TTL_MINUTES = '1'; // 1 minute
      await vi.resetModules();
      await vi.doMock('../src/mastra/storage.ts', () => ({
        storage: {
          getResourceById: vi.fn(async ({ resourceId }: { resourceId: string }) => {
            const r = resources.get(resourceId);
            if (!r) return null;
            return { id: resourceId, workingMemory: r.workingMemory ?? null, metadata: r.metadata ?? {}, createdAt: new Date(), updatedAt: new Date() } as any;
          }),
          updateResource: vi.fn(async ({ resourceId, workingMemory, metadata }: { resourceId: string; workingMemory?: string; metadata?: Record<string, unknown> }) => {
            const existing = resources.get(resourceId) || { workingMemory: null, metadata: {} };
            const next: MockResource = { workingMemory: workingMemory !== undefined ? workingMemory : existing.workingMemory ?? null, metadata: { ...(existing.metadata || {}), ...(metadata || {}) } };
            resources.set(resourceId, next);
            return { id: resourceId, ...next, createdAt: new Date(), updatedAt: new Date() } as any;
          }),
        },
      }));

      const ml = await import('../src/mastra/memoryLayer.ts');
      const message: any = { author: { id: 'U6' }, guild: { id: 'G6' }, channel: { id: 'C6', isThread: () => false } };
      await ml.rememberAfterResponse(message, 'topic pvp', 'ok');
      const chanRes = resources.get('discord:channel:C6')!;
      const exp = new Date(chanRes.metadata.expiresAt).getTime();
      const deltaMs = exp - Date.now();
      // Expect roughly 60s TTL +/- 2 minutes window
      expect(deltaMs).toBeLessThan(3 * 60 * 1000);
      expect(deltaMs).toBeGreaterThan(30 * 1000);
    } finally {
      process.env.MEMORY_CHANNEL_TTL_MINUTES = prev;
      await vi.resetModules();
    }
  });
});


