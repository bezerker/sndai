import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { wowCharacterGearAgent } from './agents';
import { storage } from './storage';
export const mastra = new Mastra({
  agents: { wowCharacterGearAgent },
  storage,
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
