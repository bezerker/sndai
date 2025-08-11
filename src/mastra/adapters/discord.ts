import { Client, Events, GatewayIntentBits, Message, TextChannel } from 'discord.js';
import { z } from 'zod';
import { debugLog } from '../debugLog';

const discordConfigSchema = z.object({
  token: z.string().min(1),
  clientId: z.string().min(1),
});

type DiscordConfig = z.infer<typeof discordConfigSchema>;

export class DiscordAdapter {
  private client: Client;
  private config: DiscordConfig;
  private messageHandler?: (message: Message) => Promise<string>;
  private userContexts: Map<string, { lastInteraction: Date; conversationCount: number }> = new Map();
  
  // Memory cleanup configuration - 6 months for WoW gear bot use case
  // This allows users to reference conversations across multiple patches and seasons
  // Can be overridden with DISCORD_MEMORY_CLEANUP_DAYS environment variable
  private static readonly MEMORY_CLEANUP_INTERVAL_DAYS = parseInt(process.env.DISCORD_MEMORY_CLEANUP_DAYS || '180', 10); // Default: 6 months
  private static readonly MEMORY_CLEANUP_RUN_INTERVAL_MS = DiscordAdapter.MEMORY_CLEANUP_INTERVAL_DAYS * 24 * 60 * 60 * 1000; // Run every N months

  constructor() {
    // Load config from environment variables
    this.config = discordConfigSchema.parse({
      token: process.env.DISCORD_BOT_TOKEN,
      clientId: process.env.DISCORD_CLIENT_ID,
    });

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on(Events.ClientReady, () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    // Additional connection and error event logging
    this.client.on('shardDisconnect', (event, id) => {
      debugLog('[DiscordAdapter]', `Shard ${id} disconnected:`, event);
    });
    this.client.on('shardReconnecting', (id) => {
      debugLog('[DiscordAdapter]', `Shard ${id} reconnecting...`);
    });
    this.client.on('error', (error) => {
      debugLog('[DiscordAdapter]', 'Discord client error:', error);
    });
    this.client.on('warn', (info) => {
      debugLog('[DiscordAdapter]', 'Discord client warning:', info);
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      debugLog('[DiscordAdapter]', 'Message received:', {
        content: message.content,
        author: message.author.tag,
        channel: message.channel.id,
      });
      // Ignore messages from bots
      if (message.author.bot) return;

      // Check if the bot was mentioned
      const mentioned = message.mentions.has(this.client.user!);
      debugLog('[DiscordAdapter]', 'Bot mentioned:', mentioned);
      if (mentioned) {
        try {
          // Track user interaction
          this.trackUserInteraction(message.author.id);
          
          // Show typing indicator if the channel is a text channel
          if (message.channel instanceof TextChannel) {
            await message.channel.sendTyping();
          }
          
          // Get response from the agent
          if (this.messageHandler) {
            const response = await this.messageHandler(message);
            debugLog('[DiscordAdapter]', 'Agent response:', response);
            // Split and send the response in chunks if needed
            const chunks = DiscordAdapter.splitMessage(response);
            for (const chunk of chunks) {
              await message.reply(chunk);
            }
            debugLog('[DiscordAdapter]', 'Replied to message');
          }
        } catch (error) {
          console.error('Error handling Discord message:', error);
          debugLog('[DiscordAdapter]', 'Error details:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          await message.reply('Sorry, I encountered an error while processing your message. Error: ' + 
            (error instanceof Error ? error.message : String(error)));
        }
      }
    });
  }

  public setMessageHandler(handler: (message: Message) => Promise<string>) {
    this.messageHandler = handler;
  }

  private trackUserInteraction(userId: string) {
    const now = new Date();
    const userContext = this.userContexts.get(userId);
    
    if (userContext) {
      userContext.lastInteraction = now;
      userContext.conversationCount++;
    } else {
      this.userContexts.set(userId, {
        lastInteraction: now,
        conversationCount: 1
      });
    }
  }

  public getUserContext(userId: string) {
    return this.userContexts.get(userId);
  }

  public async start() {
    try {
      await this.client.login(this.config.token);
      this.startMemoryCleanup(); // Start cleanup timer
    } catch (error) {
      console.error('Failed to start Discord bot:', error);
      throw error;
    }
  }

  private startMemoryCleanup() {
    // Clean up old user contexts every 6 months
    setInterval(() => {
      const cutoff = new Date(Date.now() - DiscordAdapter.MEMORY_CLEANUP_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;
      
      for (const [userId, context] of this.userContexts.entries()) {
        if (context.lastInteraction < cutoff) {
          this.userContexts.delete(userId);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`[DiscordAdapter] Memory cleanup: removed ${cleanedCount} inactive user contexts (older than ${DiscordAdapter.MEMORY_CLEANUP_INTERVAL_DAYS} days)`);
      }
    }, DiscordAdapter.MEMORY_CLEANUP_RUN_INTERVAL_MS);
  }

  public async stop() {
    try {
      await this.client.destroy();
    } catch (error) {
      console.error('Error stopping Discord bot:', error);
      throw error;
    }
  }

  private static splitMessage(text: string, maxLength = 2000): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    let current = 0;

    while (current < text.length) {
      const chunkEnd = Math.min(current + maxLength, text.length);

      if (chunkEnd >= text.length) {
        chunks.push(text.slice(current));
        break;
      }

      let splitPos = text.lastIndexOf(' ', chunkEnd);
      if (splitPos <= current) {
        splitPos = text.lastIndexOf('\n', chunkEnd);
      }

      if (splitPos <= current) {
        // No space or newline found in the chunk, so we have to split the word
        splitPos = chunkEnd;
      }

      chunks.push(text.slice(current, splitPos));
      current = splitPos;

      // Skip the space/newline character for the next chunk
      if (text[current] === ' ' || text[current] === '\n') {
        current++;
      }
    }

    return chunks;
  }
} 