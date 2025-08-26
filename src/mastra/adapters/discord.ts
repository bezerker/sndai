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

      // Ignore mass pings like @here and @everyone
      if (message.mentions.everyone) {
        debugLog('[DiscordAdapter]', 'Ignored due to @here/@everyone mention');
        return;
      }

      // Check if the bot was mentioned
      const mentioned = message.mentions.has(this.client.user!);
      debugLog('[DiscordAdapter]', 'Bot mentioned:', mentioned);
      if (mentioned) {
        try {
          // Remove the bot mention from the message
          // (leave as is, but pass the full message to handler)
          if (this.messageHandler) {
            // Maintain typing indicator while processing the message
            let stopTyping: (() => void) | undefined;
            if (message.channel instanceof TextChannel) {
              stopTyping = this.startTypingLoop(message.channel);
            }

            try {
              // Get response from the agent
              const response = await this.messageHandler(message);
              debugLog('[DiscordAdapter]', 'Agent response:', response);
              // Split and send the response in chunks if needed
              const chunks = DiscordAdapter.splitMessage(response);
              for (const chunk of chunks) {
                await message.reply(chunk);
              }
              debugLog('[DiscordAdapter]', 'Replied to message');
            } finally {
              // Ensure typing loop is stopped regardless of outcome
              stopTyping?.();
            }
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

  public async start() {
    try {
      await this.client.login(this.config.token);
    } catch (error) {
      console.error('Failed to start Discord bot:', error);
      throw error;
    }
  }

  public async stop() {
    try {
      await this.client.destroy();
    } catch (error) {
      console.error('Error stopping Discord bot:', error);
      throw error;
    }
  }

  // Start a loop to keep the typing indicator active until stopped.
  // Discord shows typing for ~10s; refresh every ~8s.
  private startTypingLoop(channel: TextChannel): () => void {
    let stopped = false;
    // Kick off immediately; guard if mocks return non-promise
    Promise.resolve((channel as any).sendTyping?.()).catch(() => {/* ignore typing errors */});
    const interval: NodeJS.Timeout = setInterval(() => {
      Promise.resolve((channel as any).sendTyping?.()).catch(() => {/* ignore typing errors */});
    }, 8000);

    return () => {
      if (!stopped) {
        clearInterval(interval);
        stopped = true;
      }
    };
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
