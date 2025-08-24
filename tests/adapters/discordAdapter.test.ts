import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock discord.js with a lightweight client and events registry
vi.mock('discord.js', () => {
  let lastClient: any;

  class Client {
    public user?: { id: string; tag: string };
    public on = vi.fn((event: string, cb: (...args: any[]) => any) => {
      this._listeners[event] = this._listeners[event] || [];
      this._listeners[event].push(cb);
    });
    public login = vi.fn(async () => {
      this.user = { id: 'bot-id', tag: 'Bot#0001' };
    });
    public destroy = vi.fn(async () => {});
    public _listeners: Record<string, Function[]> = {};
    constructor(_: any) {
      lastClient = this;
    }
  }

  class TextChannel {
    public sendTyping = vi.fn();
  }

  const Events = {
    ClientReady: 'ready',
    MessageCreate: 'messageCreate',
  } as const;

  const GatewayIntentBits = { Guilds: 1, GuildMessages: 2, MessageContent: 4 } as const;

  return {
    Client,
    Events,
    GatewayIntentBits,
    TextChannel,
    Message: class {},
    __mock: {
      getLastClient: () => lastClient,
      emit: (event: string, ...args: any[]) => {
        if (!lastClient) return;
        const listeners = lastClient._listeners[event] || [];
        for (const cb of listeners) {
          cb(...args);
        }
      },
    },
  };
});

// Ensure required env vars exist for adapter config
process.env.DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'test-discord-token';
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'test-client-id';

import { DiscordAdapter } from '../../src/mastra/adapters/discord';
import * as Discord from 'discord.js';

describe('DiscordAdapter mass-mention handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores messages containing @everyone/@here (mentions.everyone)', async () => {
    const adapter = new DiscordAdapter();
    const handler = vi.fn().mockResolvedValue('ok');
    adapter.setMessageHandler(handler);

    const message: any = {
      content: '@everyone hello',
      author: { bot: false, tag: 'tester#0001' },
      channel: { id: 'chan-1', sendTyping: vi.fn() },
      mentions: {
        everyone: true,
        has: vi.fn(() => false),
      },
      reply: vi.fn(),
    };

    // Emit the message create event
    (Discord as any).__mock.emit(Discord.Events.MessageCreate, message);

    // Should not invoke handler or reply when mass-mention is present
    expect(handler).not.toHaveBeenCalled();
    expect(message.reply).not.toHaveBeenCalled();
  });

  it('processes messages when bot is mentioned without mass mention', async () => {
    const adapter = new DiscordAdapter();
    const handler = vi.fn().mockResolvedValue('Hello back!');
    adapter.setMessageHandler(handler);

    // Ensure client.user is set so mentions.has can work
    await adapter.start();

    const mockClient: any = (Discord as any).__mock.getLastClient();
    expect(mockClient?.user?.id).toBe('bot-id');
    expect(mockClient?._listeners?.[Discord.Events.MessageCreate]?.length || 0).toBeGreaterThan(0);

    const channel = new (Discord as any).TextChannel();
    const message: any = {
      content: '<@bot-id> hello',
      author: { bot: false, tag: 'tester#0001' },
      channel,
      mentions: {
        everyone: false,
        has: vi.fn((user: any) => !!user && user.id === 'bot-id'),
      },
      reply: vi.fn().mockResolvedValue(undefined),
    };

    (Discord as any).__mock.emit(Discord.Events.MessageCreate, message);

    // Allow async handler and reply to resolve
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(message);
    expect(channel.sendTyping).toHaveBeenCalledTimes(1);
    expect(message.reply).toHaveBeenCalledTimes(1);
    expect(message.reply).toHaveBeenCalledWith('Hello back!');
  });
});
