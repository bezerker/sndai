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

  // Resolve maxSteps from environment with default for working memory compatibility
  const defaultMaxSteps = 10;
  const envMaxSteps = process.env.AGENT_MAX_STEPS;
  const parsedMaxSteps = envMaxSteps !== undefined ? Number(envMaxSteps) : defaultMaxSteps;
  const maxSteps = Number.isFinite(parsedMaxSteps) ? parsedMaxSteps : defaultMaxSteps;

  discordAdapter.setMessageHandler(async (message) => {
    try {
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
      
      console.log(`[Discord] Processing message for user ${userId}:`, {
        originalMessage: cleanMessage,
        enhancedMessage,
        threadId,
        maxSteps,
        temperature
      });
      
      const result = await wowCharacterGearAgent.generate(enhancedMessage, {
        resourceId: userId,
        threadId: threadId,
        temperature,
        maxSteps, // Use environment-configured maxSteps for working memory compatibility
      });
      
      const cleanedText = result.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      return cleanedText;
    } catch (error) {
      console.error('[Discord] Error processing message:', error);
      console.error('[Discord] Error details:', {
        message: message.content,
        userId: message.author.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error; // Re-throw to let Discord adapter handle it
    }
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
