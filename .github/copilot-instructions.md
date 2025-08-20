# WoW Character Gear Agent (sndai)

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

The sndai project is a TypeScript-based WoW Character Gear Agent built with the Mastra framework. It provides character lookups, gear recommendations, and best-in-slot (BiS) advice through Discord bot integration and standalone usage.

## Working Effectively

### Bootstrap and Setup
- Node.js v18+ is required
- Install dependencies: `npm install` -- takes 15+ minutes to complete. NEVER CANCEL. Set timeout to 30+ minutes.
- Create environment file based on `.env.development` template (see Configuration section)

### Build Process
- Development: `npm run dev` -- starts Mastra development server
- Production build: `npm run build` -- takes 5-10 minutes. NEVER CANCEL. Set timeout to 20+ minutes.
- The build uses Mastra framework which bundles the application into `.mastra/output/`

### Testing
- Run all tests: `npm test` -- takes 2-5 minutes. NEVER CANCEL. Set timeout to 10+ minutes.
- Run tests in watch mode: `npm run test:watch`
- Run memory system tests specifically: `npm run test:memory`
- Tests use Vitest framework with mocked external dependencies

### Running the Application
- Development mode: `npm run dev` -- starts the agent with hot reload
- Production mode: After building, run `node .mastra/output/index.mjs` from project root
- Discord bot: Set `DISCORD_ENABLED=true` in environment and provide bot credentials

## Configuration

### Required Environment Variables
Set these in `.env.development` for local development:

```env
# Blizzard API (required for character lookups)
BLIZZARD_CLIENT_ID=your_client_id
BLIZZARD_CLIENT_SECRET=your_client_secret

# Model provider (choose one)
MODEL_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o
# OR for Ollama
# MODEL_PROVIDER=ollama
# OLLAMA_MODEL=llama3.1:latest

# Optional features
BRAVE_API_KEY=your_brave_search_key
DISCORD_ENABLED=true
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
```

### Memory Configuration
The agent uses LibSQL database stored in `memory.db` in project root:

```env
# Memory settings (optional, these are defaults)
MEMORY_MAX_MESSAGES=40
MEMORY_SEMANTIC_RECALL_ENABLED=true
MEMORY_SEMANTIC_RECALL_TOP_K=5
MEMORY_SEMANTIC_RECALL_MESSAGE_RANGE=3
MEMORY_SEMANTIC_RECALL_SCOPE=resource
MEMORY_WORKING_MEMORY_ENABLED=true
MEMORY_WORKING_MEMORY_SCOPE=resource
```

## Validation

### Manual Testing Scenarios
After making changes, ALWAYS test these complete workflows:

1. **Character Lookup**: Ask agent to "Look up the character [name] on [server]"
2. **BiS Recommendations**: Request "What's the best gear for [spec] [class]?"
3. **Memory Persistence**: Have multiple conversations and verify the agent remembers previous context
4. **Discord Integration** (if enabled): Mention the bot in Discord and test character lookups

### Build Validation
- Always run `npm test` before committing changes
- Ensure `npm run build` completes successfully
- Test that the built application starts: `node .mastra/output/index.mjs`

## Project Structure

### Key Directories
- `src/mastra/` - Main application code
  - `agents/` - Mastra agent definitions
  - `tools/` - WoW-specific tools (character lookup, BiS scraper)
  - `adapters/` - Discord bot integration
  - `storage.ts` - Database configuration
  - `index.ts` - Main entry point
- `tests/` - Test files including memory system tests
- `.mastra/` - Build output directory (created during build)
- `charts/` - Kubernetes Helm charts for deployment

### Important Files
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `Dockerfile` - Container build configuration
- `MEMORY_CONFIGURATION.md` - Detailed memory system documentation
- `memory.db` - SQLite database file (created at runtime)

### Frequently Modified Files
When working on:
- **Character lookup features**: Edit `src/mastra/tools/index.ts` and related tool files
- **Agent behavior**: Modify `src/mastra/agents/index.ts`
- **Discord integration**: Update `src/mastra/adapters/discord.ts`
- **Memory configuration**: Check `src/mastra/storage.ts`

## Common Tasks

### Adding New Features
1. Create or modify tools in `src/mastra/tools/`
2. Update agent configuration in `src/mastra/agents/`
3. Add tests in `tests/` directory
4. Run `npm test` to validate
5. Test manually with complete user scenarios

### Debugging Issues
1. Check console output during `npm run dev`
2. Review `memory.db` for data persistence issues
3. Verify environment variables are properly set
4. Test individual tools with unit tests
5. Use Discord bot interface for end-to-end testing

### Performance Considerations
- Memory system queries can be slow with large conversation history
- BiS scraping makes external HTTP requests to icy-veins.com
- Blizzard API has rate limiting - cache results when possible
- Vector embeddings for semantic search require model provider access

## Docker Deployment

### Building Container
```bash
docker build -t sndai:latest .
```
Build takes 10-15 minutes including npm install. NEVER CANCEL.

### Running Container
```bash
docker run -d \
  -e BLIZZARD_CLIENT_ID=your_id \
  -e BLIZZARD_CLIENT_SECRET=your_secret \
  -e OPENAI_API_KEY=your_key \
  -v $(pwd)/memory.db:/app/memory.db \
  sndai:latest
```

## Troubleshooting

### Common Issues
- **Build failures**: Ensure Node.js v18+ and all environment variables are set
- **Memory database errors**: Check file permissions on `memory.db`
- **Discord bot not responding**: Verify `DISCORD_ENABLED=true` and valid credentials
- **Character lookup failures**: Validate Blizzard API credentials and rate limits
- **Tests timeout**: Increase test timeout in `package.json` vitest configuration

### Time Expectations
- `npm install`: 15-20 minutes (includes heavy dependencies)
- `npm run build`: 5-10 minutes (Mastra bundling)
- `npm test`: 2-5 minutes (includes memory system tests)
- Docker build: 10-15 minutes (full build process)

NEVER CANCEL any of these operations. They require substantial time to complete successfully.