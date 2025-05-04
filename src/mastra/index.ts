import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { wowCharacterGearAgent } from './agents';

export const mastra = new Mastra({
  // workflows: { weatherWorkflow },
  agents: { wowCharacterGearAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
