import { MCPClient } from '@mastra/mcp';

const servers: Record<string, any> = {};

// Only configure Brave MCP if BRAVE_API_KEY is provided
if (process.env.BRAVE_API_KEY && process.env.BRAVE_API_KEY.trim() !== '') {
  servers.brave = {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY },
  };
}

// Configure mcp client to connect to servers
export const mcp = new MCPClient({ servers });