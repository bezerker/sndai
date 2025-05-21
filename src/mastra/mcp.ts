import { MCPClient } from "@mastra/mcp";
import { Agent } from "@mastra/core/agent";

// Configure mcp client to connect to servers
export const mcp = new MCPClient({
  servers: {
    brave: {
      command: "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-brave-search",
      ],
      "env": {
        "BRAVE_API_KEY": process.env.BRAVE_API_KEY || "",
      },
    },
  },
});