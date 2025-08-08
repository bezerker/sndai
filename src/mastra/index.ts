import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { wowCharacterGearAgent } from './agents';
import { storage } from './storage';
import { DiscordAdapter } from './adapters/discord';

if (process.env.DISCORD_ENABLED === 'true') {
  const discordAdapter = new DiscordAdapter();

  // Resolve temperature from environment with default
  const defaultTemperature = 0.5;
  const envTemperature = process.env.DISCORD_TEMPERATURE;
  const parsedTemperature = envTemperature !== undefined ? Number(envTemperature) : defaultTemperature;
  const temperature = Number.isFinite(parsedTemperature) ? parsedTemperature : defaultTemperature;

  discordAdapter.setMessageHandler(async (message) => {
    const cleanMessage = message.content.replace(`<@${message.client.user?.id}>`, '').trim();
    const result = await wowCharacterGearAgent.generate(cleanMessage, {
      resourceId: message.author.id,
      threadId: message.channel.id,
      temperature,
    });
    const cleanedText = result.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return cleanedText;
  });

  discordAdapter.start().catch((error) => {
    console.error('Failed to start Discord adapter:', error);
  });
}

export const mastra = new Mastra({
  agents: { wowCharacterGearAgent },
  storage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
