#!/usr/bin/env node
import { config } from "dotenv";
config({ override: true });

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, executeTool } from "./tools.js";

const API_KEY = process.env.GUARDENTRY_API_KEY;
const BASE_URL = (process.env.GUARDENTRY_BASE_URL ?? "https://app.guardentry.ai").replace(/\/$/, "");

if (!API_KEY) {
  console.error("Error: GUARDENTRY_API_KEY environment variable is required");
  process.exit(1);
}

const server = new Server(
  { name: "guardentry", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Execute tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await executeTool(name, args ?? {}, API_KEY!, BASE_URL);
    return {
      content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GuardEntry MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
