# sndai - Stand and Deliver Guild's WoW Character Gear Agent

## Overview

This project is the official AI-powered agent for the **Stand and Deliver** guild in World of Warcraft. It provides character and gear recommendations using the Mastra framework. The agent fetches live character data, scrapes Best-in-Slot (BiS) gear tables from Icy-Veins, and performs web search to provide up-to-date recommendations tailored to the current patch (11.2).

> Stand and Deliver is recruiting! Learn more at [https://sndguild.com](https://sndguild.com).

## Features

- Fetches WoW character and gear data from Blizzard's official API
- Scrapes BiS gear tables from Icy-Veins for the latest recommendations
- Provides context-aware, game-mode-specific advice (Mythic+, Raid, PvP, World Content)
- Remembers previous lookups and conversations for improved suggestions (local vector memory)
- Supports OpenAI and Ollama LLM providers
- Integrates with Mastra MCP for tool orchestration and web search (Brave)
- Optional Discord bot to interact in your guild server

## Requirements

- Node.js v18+
- Blizzard API credentials (Client ID and Secret)
- Optional: OpenAI API key or an Ollama model
- Optional: Brave API key (for web search)
- Optional: Discord bot token and client ID (for Discord integration)

## Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set environment variables (create a `.env` file or export in your shell):

- Blizzard API (required for character lookups)
  - `BLIZZARD_CLIENT_ID`
  - `BLIZZARD_CLIENT_SECRET`
- Model provider (choose one)
  - `MODEL_PROVIDER` = `openai` | `ollama` (default: `openai`)
  - If using OpenAI:
    - `OPENAI_API_KEY` (required when using the OpenAI API)
    - `OPENAI_MODEL` (default: `gpt-4o`)
    - `OPENAI_BASE_URL` (optional; default: `https://api.openai.com/v1`)
  - If using Ollama:
    - `OLLAMA_MODEL` (default: `llama3.1:latest`)
- Web search (optional)
  - `BRAVE_API_KEY`
- Discord (optional)
  - `DISCORD_ENABLED` = `true` to enable the bot
  - `DISCORD_BOT_TOKEN`
  - `DISCORD_CLIENT_ID`
  - `DISCORD_MEMORY_CLEANUP_DAYS` (optional; default: 180 days / 6 months) - How long to keep user conversation history

- Memory Configuration (optional; tune for your LLM context window)
  - `MEMORY_LAST_MESSAGES` (default: 100) - Number of recent messages to include in context
  - `MEMORY_SEMANTIC_TOP_K` (default: 5) - Number of semantically similar messages to retrieve
  - `MEMORY_SEMANTIC_RANGE` (default: 3) - Context messages around each semantic match

- Working Memory Configuration (optional; enables persistent user profiles)
  - `MEMORY_WORKING_MEMORY_ENABLED` (default: true) - Enable/disable working memory
  - `MEMORY_WORKING_MEMORY_SCOPE` (default: resource) - 'thread' or 'resource' scoped memory
  - `MEMORY_WORKING_MEMORY_TEMPLATE` (optional) - Custom template for user profiles

## Memory Configuration Guide

### **Recommended Settings by LLM Context Window:**

#### **🟢 Small Context (4K-8K tokens) - Llama 3.1, small Ollama models:**

```bash
MEMORY_LAST_MESSAGES=15
MEMORY_SEMANTIC_TOP_K=1
MEMORY_SEMANTIC_RANGE=0
```

#### **🟡 Medium Context (8K-32K tokens) - GPT-4o Mini, most models:**

```bash
MEMORY_LAST_MESSAGES=30
MEMORY_SEMANTIC_TOP_K=2
MEMORY_SEMANTIC_RANGE=1
```

#### **🟠 Large Context (32K-128K tokens) - GPT-4o, Claude 3.5:**

```bash
MEMORY_LAST_MESSAGES=50
MEMORY_SEMANTIC_TOP_K=3
MEMORY_SEMANTIC_RANGE=2
```

#### **🔴 Massive Context (128K+ tokens) - GPT-5-nano (400K):**

```bash
MEMORY_LAST_MESSAGES=100
MEMORY_SEMANTIC_TOP_K=5
MEMORY_SEMANTIC_RANGE=3
```

### **Example .env.development for GPT-5-nano:**

```bash
# Copy these settings to your .env.development file
MODEL_PROVIDER=openai
OPENAI_MODEL=gpt-5-nano
OPENAI_API_KEY=your_key_here

# Optimized for 400K token context window
MEMORY_LAST_MESSAGES=100
MEMORY_SEMANTIC_TOP_K=5
MEMORY_SEMANTIC_RANGE=3

# Working memory for persistent user profiles
MEMORY_WORKING_MEMORY_ENABLED=true
MEMORY_WORKING_MEMORY_SCOPE=resource
```

## Working Memory Benefits

### **🧠 What Working Memory Provides:**

Working memory is like your bot's "active scratchpad" that maintains persistent, structured information about users across all conversations. It's **completely separate** from semantic recall and provides different benefits:

#### **✅ Persistent User Profiles:**

- **Character names, servers, and regions** remembered forever
- **Game preferences** (Mythic+ vs Raid vs PvP) maintained
- **Current goals and progress** tracked across sessions
- **No more repetitive questions** about basic info

#### **✅ Enhanced Personalization:**

```typescript
// Before: Bot asks every time
"Hi! What's your character name and server?"

// After: Bot remembers and personalizes
"Hey Sam! Welcome back to Illidan-US.
I see you're still working on that Fire Mage BiS list.
Your last check showed you at 485 ilvl - any upgrades since then?"
```

#### **✅ Cross-Session Context:**

- **Discord sessions** maintain user context
- **Different conversation threads** share the same profile
- **Long-term goal tracking** across weeks/months
- **Progressive gear improvement** monitoring

### **🔄 How It Works with Semantic Recall:**

| Feature      | Semantic Recall                        | Working Memory                       |
| ------------ | -------------------------------------- | ------------------------------------ |
| **Purpose**  | Find relevant past conversations       | Store persistent user facts          |
| **Scope**    | Searches message history               | Maintains structured profiles        |
| **Updates**  | Automatic with new messages            | Agent-controlled updates             |
| **Use Case** | "What did we discuss about tank gear?" | "What's this user's character name?" |

#### **Perfect Together:**

1. **Working Memory** remembers: "Sam plays Fire Mage on Illidan-US, prefers Mythic+"
2. **Semantic Recall** finds: "Last week we discussed Fire Mage BiS for Mythic+25"
3. **Combined Result**: Highly personalized, context-aware responses

### **🎮 WoW Bot Specific Benefits:**

- **Character Lookups**: Bot remembers your main character details
- **Gear Progression**: Tracks your item level improvements over time
- **Content Preferences**: Knows you prefer Mythic+ over raiding
- **BiS Tracking**: Remembers when you last checked for upgrades
- **Session Continuity**: Picks up where you left off in previous conversations

3. (Optional) If using a custom memory DB location, update `src/mastra/storage.ts` (defaults to `memory.db` in the repo root).

## Usage

- Development:

  ```bash
  npm run dev
  ```

- Production build:

  ```bash
  npm run build
  ```

- Discord bot (optional):
  - Set `DISCORD_ENABLED=true` and provide `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID`
  - Start the app (`npm run dev` or use your built output)
  - Mention the bot in a channel and ask for lookups or recommendations

The agent is exposed via the Mastra framework and can be integrated into a Mastra server or used standalone.

## Agent Details

- Name: WoW Character Gear Agent
- Primary Function:
  - Look up WoW character information and gear by name and server
  - Provide BiS and alternative gear recommendations based on the latest patch and game mode
  - Use Blizzard API, Icy-Veins scraping, and web search for the most current data
- Tools Used:
  - `wowCharacterGearTool`: Fetches character and gear data from Blizzard API
  - `bisScraperTool`: Scrapes BiS gear tables from Icy-Veins
  - Web search via MCP (Brave)

## Configuration

- All configuration is handled via environment variables
- Memory is stored locally in `memory.db` (LibSQL) in the project root by default

## Project Structure

- `src/mastra/agents/`: Agent implementation and logic
- `src/mastra/tools/`: Custom tools for WoW data and BiS scraping
- `src/mastra/index.ts`: Mastra entry point exporting the agent
- `src/mastra/storage.ts`: Memory storage configuration
- `src/mastra/mcp.ts`: MCP client configuration for web search
- `src/mastra/adapters/discord.ts`: Optional Discord adapter

## Testing

See `tests/README.md` for Vitest-based instructions, commands, and mocking notes. The default `npm test` script is a placeholder.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## Contact

For questions or contributions, please open an issue or pull request. If you're interested in joining the Stand and Deliver guild, visit [https://sndguild.com](https://sndguild.com).
