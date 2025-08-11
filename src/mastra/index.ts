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
    const userId = message.author.id;
    const userContext = discordAdapter.getUserContext(userId);
    
    // Create a more descriptive thread ID for better memory organization
    const threadId = `discord-user-${userId}-${message.author.username}`;
    
    // Add user context to the message for better personalization
    let enhancedMessage = cleanMessage;
    if (userContext && userContext.conversationCount > 1) {
      enhancedMessage = `[User has ${userContext.conversationCount} previous interactions] ${cleanMessage}`;
    }
    
    const result = await wowCharacterGearAgent.generate(enhancedMessage, {
      resourceId: userId,
      threadId: threadId,
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
