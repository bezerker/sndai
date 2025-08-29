# sndai - Stand and Deliver Guild's WoW Character Gear Agent

## Overview

This project is the official AI-powered agent for the **Stand and Deliver** guild in World of Warcraft. It provides character and gear recommendations using the Mastra framework. The agent fetches live character data, scrapes Best-in-Slot (BiS) gear tables from Icy-Veins, and performs web search to provide up-to-date recommendations tailored to the current patch (11.2).

> Stand and Deliver is recruiting! Learn more at [https://sndguild.com](https://sndguild.com).

## Features

- Fetches WoW character and gear data from Blizzard's official API
- Scrapes BiS gear tables from Icy-Veins for the latest recommendations
- Provides context-aware, game-mode-specific advice (Mythic+, Raid, PvP, World Content)
- Remembers previous lookups and conversations for improved suggestions (local vector memory)
- Privacy: conversations and memory are scoped to the current user; the bot cannot access other users' conversations and will remind about this when relevant
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

2. Set environment variables (use `.env.development` for local dev or export in your shell):

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
  - `DISCORD_TEMPERATURE` (optional; default: `0.5`)
- Agent behavior (optional)
  - `AGENT_MAX_STEPS` (optional; maximum number of execution steps for the agent, defaults to no limit)
  - `MEMORY_MAX_MESSAGES` (optional; maximum number of messages to remember per thread, defaults to `10`)

3. (Optional) If using a custom memory DB location, update `src/mastra/storage.ts` (defaults to `memory.db` in the repo root).

## Kubernetes / Helm

This repository uses the Helm chart in `charts/sndai` as the single source of truth for Kubernetes manifests. The previous static `deploy/` manifests have been removed to avoid duplication and drift.

To render the chart locally (produces standard Kubernetes YAML):

```bash
helm template sndai charts/sndai --values charts/sndai/values.yaml > rendered.yaml
```

To install into a cluster with Helm:

```bash
helm upgrade --install sndai charts/sndai --values charts/sndai/values.yaml
```

If you prefer `kubectl apply` you can render then apply:

```bash
helm template sndai charts/sndai --values charts/sndai/values.yaml | kubectl apply -f -
```

Tip: change values either by editing `charts/sndai/values.yaml` or passing `--set` to `helm`.

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
  - `web-search`: Lightweight Google-based search (no API key)
  - `fetch-url-content`: Extracts article content from a URL
  - Web search via MCP (Brave) when available

## Configuration

- All configuration is handled via environment variables
- Memory is stored locally in `memory.db` (LibSQL) in the project root by default
- Agent execution can be limited by setting `AGENT_MAX_STEPS` to control the maximum number of steps the agent can take during a single generation call
- Memory retention can be controlled with `MEMORY_MAX_MESSAGES` to set how many messages are remembered per conversation thread

### Memory configuration

This project uses Mastra's memory system combining:

- Basic conversation history (last N messages)
- Semantic recall (vector search over past messages)
- Working memory (persistent user profile/scratchpad)

When calling the agent, always pass both a resource and a thread identifier so memory can be scoped:

```ts
await wowCharacterGearAgent.generate("...", {
  memory: { resource: "user_123", thread: "conversation_abc" },
});
```

Environment variables:

- `MEMORY_MAX_MESSAGES`: number of recent messages to include (default: `10`)
- `MEMORY_SEMANTIC_RECALL_ENABLED`: enable/disable semantic recall (default: `true`)
- `MEMORY_SEMANTIC_RECALL_TOP_K`: number of similar messages to retrieve (default: `5`)
- `MEMORY_SEMANTIC_RECALL_MESSAGE_RANGE`: surrounding messages per match (default: `3`)
- `MEMORY_SEMANTIC_RECALL_SCOPE`: `thread` or `resource` (default: `resource`)
- `MEMORY_WORKING_MEMORY_ENABLED`: enable/disable working memory (default: `true`)
- `MEMORY_WORKING_MEMORY_SCOPE`: `thread` or `resource` (default: `resource`)
- `MEMORY_WORKING_MEMORY_TEMPLATE`: optional custom template string for working memory (default: WoW‑focused template in code)

Example `.env` snippet:

```env
# Basic history
MEMORY_MAX_MESSAGES=10

# Semantic recall
MEMORY_SEMANTIC_RECALL_ENABLED=true
MEMORY_SEMANTIC_RECALL_TOP_K=5
MEMORY_SEMANTIC_RECALL_MESSAGE_RANGE=3
MEMORY_SEMANTIC_RECALL_SCOPE=resource

# Working memory
MEMORY_WORKING_MEMORY_ENABLED=true
MEMORY_WORKING_MEMORY_SCOPE=resource
# MEMORY_WORKING_MEMORY_TEMPLATE="# Custom Template\n- Field 1:\n- Field 2:"
```

Notes:

- Resource‑scoped memory requires a compatible store; this project uses LibSQL which supports it.
- Semantic recall requires embeddings and a vector DB; this project uses FastEmbed and LibSQLVector already configured.
- To disable semantic recall, set `MEMORY_SEMANTIC_RECALL_ENABLED=false`.

### Privacy & Scope

- Per-user isolation: Conversations and memory are scoped to a single user (the resource). The agent cannot access or reference other users' conversations.
- Resource mapping: Be consistent in how you set the resource identifier. In the Discord adapter, `resourceId` is `message.author.id`, and `threadId` is `discord-<author.id>` so memory persists across channels for the same user.
- Reminder behavior: The system prompt instructs the agent to clarify this privacy scope only when relevant (e.g., when a user expects cross-user or cross-channel memory) to avoid unnecessary repetition.

## Project Structure

- `src/mastra/agents/`: Agent implementation and logic
- `src/mastra/tools/`: Custom tools for WoW data and BiS scraping
- `src/mastra/index.ts`: Mastra entry point exporting the agent
- `src/mastra/storage.ts`: Memory storage configuration
- `src/mastra/mcp.ts`: MCP client configuration for web search
- `src/mastra/adapters/discord.ts`: Optional Discord adapter

## Testing

Run the Vitest suites:

- `npm test`: runs the full test suite once
- `npm run test:watch`: watch mode
- `npm run test:memory`: runs only memory-system tests
- Coverage: `npx vitest run --coverage`

Tests mock external services and network calls for fast, isolated runs.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## Contact

For questions or contributions, please open an issue or pull request. If you're interested in joining the Stand and Deliver guild, visit [https://sndguild.com](https://sndguild.com).
