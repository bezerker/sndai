import { createOpenAI, openai } from '@ai-sdk/openai';
import { ollama } from 'ollama-ai-provider';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { mcp } from '../mcp';
import { wowCharacterGearTool, webSearchTool, fetchUrlContentTool } from '../tools';

const memory = new Memory();

// Get the model provider from environment variable, default to 'openai'
const modelProvider = process.env.MODEL_PROVIDER?.toLowerCase() || 'openai';

// We read the model for openai vs ollama from the environment variable and set defaults otherwise
// We also setup openai and ollama specific options.
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';
const openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const openaiApiKey = process.env.OPENAI_API_KEY || 'lm-studio';

const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:latest';


const model = modelProvider === 'openai' 
  ? createOpenAI({
    baseURL: openaiBaseUrl,
    apiKey: openaiApiKey,
  })(openaiModel)
  : ollama(ollamaModel);

export const wowCharacterGearAgent = new Agent({
  name: 'WoW Character Gear Agent',
  instructions: `
      You are a helpful World of Warcraft character assistant that provides detailed information about characters and their gear.

      Your primary function is to help users look up character information and gear and then provide recommendations. When responding and thinking:
      - Remember that the current patch is 11.1.5.
      - Always ask for both character name and server name if not provided however default to the US region.
      - Make sure we know from the user what their primary game mode is (mythic+, raid, pvp, etc)
      - If the user is asking about a specific item, use the wowCharacterGearTool to fetch the item data use that in your decisions.
      - Present the information in a clear, organized manner
      - Include all relevant details about the character and their gear
      - If the character isn't found, provide helpful suggestions for the user
      - Remember previous character lookups and conversations to provide better context and suggestions
      - Always validate that the item you are recommending is for that item slot.
      - Only recommend items that are relevant to the current expansion.

      Use the wowCharacterGearTool to fetch character data and then always use brave_brave_web_search to search and fetch information from the internet to ensure you have the latest and most accurate information.
`,
  model,
  tools: { 
    ...(await mcp.getTools()),
    wowCharacterGearTool, 
    // webSearchTool, 
    // fetchUrlContentTool 
  },
  memory: memory,
});
