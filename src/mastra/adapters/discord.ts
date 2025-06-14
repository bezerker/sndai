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

      // Check if the bot was mentioned
      const mentioned = message.mentions.has(this.client.user!);
      debugLog('[DiscordAdapter]', 'Bot mentioned:', mentioned);
      if (mentioned) {
        try {
          // Remove the bot mention from the message
          // (leave as is, but pass the full message to handler)
          if (this.messageHandler) {
            debugLog('[DiscordAdapter]', 'Calling messageHandler...');
            try {
              if (message.channel instanceof TextChannel) {
                await message.channel.sendTyping();
              }
              const response = await this.messageHandler(message);
              debugLog('[DiscordAdapter]', 'Agent response:', response);

              // Remove <think>...</think> section if it exists (robust, case-insensitive, multiline, allow whitespace)
              const cleanedResponse = response?.replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '').trim();
              debugLog('[DiscordAdapter]', 'Cleaned agent response:', cleanedResponse);

              if (!cleanedResponse) {
                await message.reply('Sorry, I have no response to show.');
                return;
              }
              const chunks = DiscordAdapter.splitMessage(cleanedResponse);
              for (const chunk of chunks) {
                await message.reply(chunk);
              }
              debugLog('[DiscordAdapter]', 'Replied to message');
            } catch (err) {
              console.error('[DiscordAdapter] Error in messageHandler:', err);
              await message.reply('Sorry, I encountered an error while processing your message.');
            }
          } else {
            debugLog('[DiscordAdapter]', 'No messageHandler set!');
          }
        } catch (error) {
          console.error('Error handling Discord message:', error);
          await message.reply('Sorry, I encountered an error while processing your message.');
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

  private static splitMessage(text: string, maxLength = 2000): string[] {
    const result: string[] = [];
    let current = 0;
    while (current < text.length) {
      result.push(text.slice(current, current + maxLength));
      current += maxLength;
    }
    return result;
  }
} 