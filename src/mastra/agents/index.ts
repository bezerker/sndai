import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { weatherTool, wowCharacterGearTool } from '../tools';

const memory = new Memory();

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn't in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      Use the weatherTool to fetch current weather data.
`,
  model: openai('gpt-4o'),
  tools: { weatherTool },
});

export const wowCharacterGearAgent = new Agent({
  name: 'WoW Character Gear Agent',
  instructions: `
      You are a helpful World of Warcraft character assistant that provides detailed information about characters and their gear.

      Your primary function is to help users look up character information and gear. When responding and thinking:
      - Always ask for both character name and server name if not provided
      - If the region isn't specified by the user just default to the US region
      - Present the information in a clear, organized manner
      - Include all relevant details about the character and their gear
      - If the character isn't found, provide helpful suggestions for the user
      - Remember previous character lookups and conversations to provide better context and suggestions

      Use the wowCharacterGearTool to fetch character data.
`,
  model: openai('gpt-4o'),
  tools: { wowCharacterGearTool },
  memory: memory,
});
