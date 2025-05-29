# sndai

# sndai - WoW Character Gear Agent

## Overview

This project is the official AI-powered agent for the **Stand and Deliver** guild in World of Warcraft. It provides character and gear recommendations, leveraging the Mastra framework. The agent fetches live character data, scrapes Best-in-Slot (BiS) gear tables from Icy-Veins, and uses web search to provide up-to-date recommendations tailored to the current patch (11.1.5).

> **Stand and Deliver is recruiting!** If you're interested in joining our community, visit [https://sndguild.com](https://sndguild.com) for more information.

## Features

- Fetches WoW character and gear data from Blizzard's official API.
- Scrapes BiS gear tables from Icy-Veins for the latest recommendations.
- Provides context-aware, game-mode-specific advice (Mythic+, Raid, PvP, World Content).
- Remembers previous lookups and conversations for improved suggestions.
- Supports both OpenAI and Ollama LLM providers.
- Integrates with Mastra MCP for tool orchestration and web search.
- Uses local vector memory (LibSQL) for conversation context.

## Requirements

- Node.js (v18+ recommended)
- Blizzard API credentials (Client ID and Secret)
- (Optional) OpenAI API key or Ollama model for LLM
- (Optional) Brave API key for web search

## Installation

1. Install dependencies:
   npm install

2. Set up environment variables (create a `.env` file or export in your shell):

   - `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` (required)
   - `OPENAI_API_KEY` (if using OpenAI)
   - `OPENAI_MODEL` (default: gpt-4o)
   - `OLLAMA_MODEL` (if using Ollama, default: llama3.1:latest)
   - `MODEL_PROVIDER` (set to `openai` or `ollama`)
   - `BRAVE_API_KEY` (optional, for web search)

3. (Optional) If using a custom memory DB location, update `src/mastra/storage.ts`.

## Usage

- **Development:**
  npm run dev

- **Production Build:**
  npm run build

- The agent is exposed via the Mastra framework and can be integrated into a Mastra server or used as a standalone agent.

## Agent Details

- **Name:** WoW Character Gear Agent
- **Primary Function:**
  - Look up WoW character information and gear by name and server.
  - Provide BiS and alternative gear recommendations based on the latest patch and game mode.
  - Use Blizzard API, Icy-Veins scraping, and web search for the most current data.
- **Tools Used:**
  - `wowCharacterGearTool`: Fetches character and gear data from Blizzard API.
  - `bisScraperTool`: Scrapes BiS gear tables from Icy-Veins.
  - Web search (via MCP/Brave) for up-to-date meta and recommendations.

## Configuration

- All configuration is handled via environment variables.
- Memory is stored in `memory.db` (LibSQL format) in the project root by default.

## Project Structure

- `src/mastra/agents/`: Agent implementation and logic.
- `src/mastra/tools/`: Custom tools for WoW data and BiS scraping.
- `src/mastra/index.ts`: Mastra entry point exporting the agent.
- `src/mastra/storage.ts`: Memory storage configuration.
- `src/mastra/mcp.ts`: MCP client configuration for tool orchestration and web search.

## Dependencies

- @mastra/core, @mastra/memory, @mastra/libsql, @mastra/fastembed, @ai-sdk/openai, ollama-ai-provider, undici, cheerio, zod, etc.

## License

Apache License 2.0. See the LICENSE file for details.

## Contact

For questions or contributions, please open an issue or pull request on the repository.
