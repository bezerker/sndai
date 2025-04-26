import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow } from './workflows';
import { weatherAgent, wowCharacterGearAgent } from './agents';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent, wowCharacterGearAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
