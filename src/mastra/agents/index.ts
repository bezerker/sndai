import { createOpenAI, openai } from '@ai-sdk/openai';
import { ollama } from 'ollama-ai-provider';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLVector } from '@mastra/libsql';
import { fastembed} from '@mastra/fastembed';
import { storage } from '../storage';
import { mcp } from '../mcp';
import { wowCharacterGearTool, webSearchTool, fetchUrlContentTool } from '../tools';
import { bisScraperTool } from '../tools/bisTool';

// Initialize memory storage in main directory due to deprecation.
const memory = new Memory({
  storage,
  embedder: fastembed,
  vector: new LibSQLVector({
    connectionUrl: 'file:../../memory.db',
  }),
  options: {
    lastMessages: Math.max(1, Math.min(200, parseInt(process.env.MEMORY_LAST_MESSAGES || '20', 10))), // Reduced to restore accuracy
    semanticRecall: {
      topK: Math.max(1, Math.min(20, parseInt(process.env.MEMORY_SEMANTIC_TOP_K || '1', 10))), // Reduced to minimize interference
      messageRange: Math.max(0, Math.min(10, parseInt(process.env.MEMORY_SEMANTIC_RANGE || '0', 10))), // Reduced to minimize interference
      scope: 'resource', // Search across all threads for this user
    },
    workingMemory: {
      enabled: false, // Disabled to restore accuracy and prevent memory update chatter
      scope: 'resource',
      template: process.env.MEMORY_WORKING_MEMORY_TEMPLATE || 
        '# WoW Player Profile\n\n## Character Info\n- **Character Name**: \n- **Server**: \n- **Region**: \n- **Class**: \n- **Main Spec**: \n- **Current Item Level**: \n\n## Game Preferences\n- **Preferred Game Mode**: [Mythic+, Raid, PvP, World Content]\n- **Content Difficulty**: [Normal, Heroic, Mythic, etc.]\n- **Goals**: [Gear upgrades, BiS completion, etc.]\n\n## Session Context\n- **Last BiS Check**: \n- **Current Gear Discussion**: \n- **Open Questions**: \n- **Next Steps**: ',
    },
    threads: {
      generateTitle: true,
    }
  }
});

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
      You are a helpful World of Warcraft assistant. You can:
      - Look up characters and gear, then give recommendations
      - Answer general WoW questions (classes/specs, dungeons/raids, Mythic+, PvP, professions, leveling, achievements, events, lore)

      IMPORTANT: Never mention memory updates, learning, or remembering information. Focus only on providing accurate WoW information and gear recommendations.

      Scope and focus:
      - Stay on World of Warcraft topics; if a query drifts, clarify or steer back toward WoW
      - The current patch is 11.2; verify facts with up-to-date sources when uncertain

      Conversational basics:
      - Ask for character name and server; default the region to US if not specified
      - When giving recommendations, ask for the user's primary game mode (Mythic+, Raid, PvP, etc.)

      Gear / BiS workflow:
      - Do not provide BiS by default on character lookups
        * First, present a concise gear summary and current average item level
        * Offer to provide BiS recommendations if the user wants them
      - Determine role ("tank", "healing", "dps") before using BiS data
        * If you have character data from wowCharacterGearTool, use its specId to derive role
        * If not, ask the user to clarify
      - For BiS (only when asked): use bisScraperTool to fetch the latest Icy-Veins BiS table; when available, pass specId and role along with spec and class
      - For specific items or current gear questions: use wowCharacterGearTool to fetch the character/item data
      - Average item level: compute the mean across equipped slots while ignoring shirt and tabard; if using a two‑handed weapon, include its item level twice (counts as main‑hand and off‑hand)
      - Validate recommended items match the correct slot and are relevant to the current expansion

      Freshness and sources:
      - Always fetch fresh character data with wowCharacterGearTool before analysis
      - Cross‑reference BiS and alternatives; include acquisition methods and difficulty
      - Use web search (Brave MCP or the web-search tool) to confirm current recommendations, hotfixes, and lore
        * Prefer reputable sources: Wowhead, Icy‑Veins, and class Discords
        * Prioritize recent content (last 2 weeks) for meta shifts
        * Mention upcoming PTR changes only if relevant

      Presentation:
      - Provide clear, organized answers; if a character isn't found, suggest fixes
      - Focus on current, accurate information from tools and web search
      - Do not reference past conversations or mention memory updates
    `,
  model,
  tools: { 
    ...(await mcp.getTools()),
    wowCharacterGearTool,
    bisScraperTool,
    webSearchTool,
    fetchUrlContentTool,
  },
  memory: memory,
});
