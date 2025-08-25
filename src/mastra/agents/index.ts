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

// Get memory configuration from environment variables
const memoryMaxMessages = process.env.MEMORY_MAX_MESSAGES ? parseInt(process.env.MEMORY_MAX_MESSAGES, 10) : 40;

// Memory configuration from environment variables
const semanticRecallEnabled = process.env.MEMORY_SEMANTIC_RECALL_ENABLED !== 'false';
const semanticRecallTopK = process.env.MEMORY_SEMANTIC_RECALL_TOP_K ? parseInt(process.env.MEMORY_SEMANTIC_RECALL_TOP_K, 10) : 5;
const semanticRecallMessageRange = process.env.MEMORY_SEMANTIC_RECALL_MESSAGE_RANGE ? parseInt(process.env.MEMORY_SEMANTIC_RECALL_MESSAGE_RANGE, 10) : 3;
const semanticRecallScope = (process.env.MEMORY_SEMANTIC_RECALL_SCOPE as 'thread' | 'resource') || 'resource';

const workingMemoryEnabled = process.env.MEMORY_WORKING_MEMORY_ENABLED !== 'false';
const workingMemoryScope = (process.env.MEMORY_WORKING_MEMORY_SCOPE as 'thread' | 'resource') || 'resource';

// WoW-specific working memory template
const defaultWoWTemplate = `# WoW Player Profile

## Character Information
- **Character Name**: 
- **Server/Region**: 
- **Favorite Classes**: 
- **Current Main**: 

## Playstyle & Preferences
- **Primary Game Mode**: [Mythic+, Raid, PvP, Casual]
- **Gear Focus**: [BiS, Good Enough, Transmog]
- **Difficulty Preference**: [Easy, Normal, Heroic, Mythic]

## Current Goals & Context
- **Current Goals**: 
- **Last Character Lookup**: 
- **Recent Topics Discussed**: 
- **Open Questions**: 

## User Preferences
- **Communication Style**: [Detailed, Concise, Technical, Casual]
- **Information Depth**: [Basic, Standard, Advanced]
- **Update Frequency**: [Always Fresh, Cached OK]`;

// Custom working memory template from environment (if provided)
const workingMemoryTemplate = process.env.MEMORY_WORKING_MEMORY_TEMPLATE || defaultWoWTemplate;

// Initialize enhanced memory with semantic recall and working memory
const memory = new Memory({
  storage,
  embedder: fastembed,
  vector: new LibSQLVector({
    connectionUrl: 'file:../../memory.db',
  }),
  options: {
    lastMessages: memoryMaxMessages,
    semanticRecall: semanticRecallEnabled ? {
      topK: semanticRecallTopK,
      messageRange: semanticRecallMessageRange,
      scope: semanticRecallScope,
    } : false,
    workingMemory: workingMemoryEnabled ? {
      enabled: true,
      scope: workingMemoryScope,
      template: workingMemoryTemplate,
    } : undefined,
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

// Get maxSteps from environment variable, default to undefined (no limit)
const maxSteps = process.env.AGENT_MAX_STEPS ? parseInt(process.env.AGENT_MAX_STEPS, 10) : undefined;

export const agentMaxSteps = maxSteps;

const model = modelProvider === 'openai' 
  ? createOpenAI({
    baseURL: openaiBaseUrl,
    apiKey: openaiApiKey,
  })(openaiModel)
  : ollama(ollamaModel);



export const wowCharacterGearAgent = new Agent({
  name: 'WoW Character Gear Agent',
  instructions: `
      You are a helpful World of Warcraft assistant with enhanced memory capabilities. You can:
      - Look up characters and gear, then give recommendations
      - Answer general WoW questions (classes/specs, dungeons/raids, Mythic+, PvP, professions, leveling, achievements, events, lore)
      - Remember user preferences and character details across conversations using working memory
      - Recall relevant information from past conversations using semantic memory

      Memory and Context Management:
      - Use working memory to track and update user preferences, character details, and playstyle information
      - Leverage semantic recall to find relevant past conversations and build upon previous discussions
      - Always check working memory first for user details before asking for information
      - Update working memory when users share new preferences, character details, or goals
      - Use semantic recall to reference previous character lookups, gear discussions, or WoW questions
      - If the message is a reply and includes third‑party context (from a different user), treat it as topical context only. Do not attribute third‑party personal details (e.g., character name, server, preferences) to the current user unless they explicitly confirm.

      Scope and focus:
      - Stay on World of Warcraft topics; if a query drifts, clarify or steer back toward WoW
      - The current patch is 11.2; verify facts with up-to-date sources when uncertain

      Conversational basics:
      - Check working memory for character name and server; if missing, ask the user for them. If region is not specified, default to US.
      - For recommendations, check working memory for the user's primary game mode (Mythic+, Raid, PvP, etc.) and preferred difficulty; if missing, ask for them.
      - Use semantic recall to reference previous character lookups and build upon past recommendations.

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
      - Reference working memory for personalized recommendations based on user preferences
      - Use semantic recall to provide continuity and build upon previous conversations
      - Update working memory with new information learned during the conversation
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
  defaultGenerateOptions: agentMaxSteps ? { maxSteps: agentMaxSteps } : undefined,
});


