import { Client, Events, GatewayIntentBits, Message, TextChannel } from 'discord.js';
import { z } from 'zod';

const discordConfigSchema = z.object({
  token: z.string().min(1),
  clientId: z.string().min(1),
});

type DiscordConfig = z.infer<typeof discordConfigSchema>;

export class DiscordAdapter {
  private client: Client;
  private config: DiscordConfig;
  private messageHandler?: (message: string) => Promise<string>;
  private debug: boolean;

  constructor() {
    // Load config from environment variables
    this.config = discordConfigSchema.parse({
      token: process.env.DISCORD_BOT_TOKEN,
      clientId: process.env.DISCORD_CLIENT_ID,
    });

    this.debug = !!process.env.DEBUG;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
  }

  private logDebug(...args: any[]) {
    if (this.debug) {
      console.debug('[DiscordAdapter]', ...args);
    }
  }

  private setupEventHandlers() {
    this.client.on(Events.ClientReady, () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    // Additional connection and error event logging
    this.client.on('shardDisconnect', (event, id) => {
      this.logDebug(`Shard ${id} disconnected:`, event);
    });
    this.client.on('shardReconnecting', (id) => {
      this.logDebug(`Shard ${id} reconnecting...`);
    });
    this.client.on('error', (error) => {
      this.logDebug('Discord client error:', error);
    });
    this.client.on('warn', (info) => {
      this.logDebug('Discord client warning:', info);
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      this.logDebug('Message received:', {
        content: message.content,
        author: message.author.tag,
        channel: message.channel.id,
      });
      // Ignore messages from bots
      if (message.author.bot) return;

      // Check if the bot was mentioned
      const mentioned = message.mentions.has(this.client.user!);
      this.logDebug('Bot mentioned:', mentioned);
      if (mentioned) {
        try {
          // Remove the bot mention from the message
          const cleanMessage = message.content.replace(`<@${this.client.user!.id}>`, '').trim();
          this.logDebug('Cleaned message:', cleanMessage);
          
          if (this.messageHandler) {
            // Show typing indicator if the channel is a text channel
            if (message.channel instanceof TextChannel) {
              await message.channel.sendTyping();
            }
            
            // Get response from the agent
            const response = await this.messageHandler(cleanMessage);
            this.logDebug('Agent response:', response);
            
            // Split and send the response in chunks if needed
            const chunks = DiscordAdapter.splitMessage(response);
            for (const chunk of chunks) {
              await message.reply(chunk);
            }
            this.logDebug('Replied to message');
          }
        } catch (error) {
          console.error('Error handling Discord message:', error);
          await message.reply('Sorry, I encountered an error while processing your message.');
        }
      }
    });
  }

  public setMessageHandler(handler: (message: string) => Promise<string>) {
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