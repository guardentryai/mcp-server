#!/usr/bin/env node
import { config } from "dotenv";
config({ override: true });

import { randomUUID } from "crypto";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, executeTool } from "./tools.js";

const API_KEY = process.env.GUARDENTRY_API_KEY;
const BASE_URL = (process.env.GUARDENTRY_BASE_URL ?? "https://app.guardentry.ai").replace(/\/$/, "");
const PORT = Number(process.env.MCP_PORT ?? 3001);

if (!API_KEY) {
  console.error("Error: GUARDENTRY_API_KEY environment variable is required");
  process.exit(1);
}

// Optional comma-separated allowlist: MCP_TOOLS=guardentry_evaluate_action,guardentry_list_risks
const toolAllowlist = process.env.MCP_TOOLS
  ? new Set(process.env.MCP_TOOLS.split(",").map((t) => t.trim()).filter(Boolean))
  : null;

const activeTools = toolAllowlist ? tools.filter((t) => toolAllowlist.has(t.name)) : tools;

function buildServer(): Server {
  const server = new Server(
    { name: "guardentry-apr", version: "0.2.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: activeTools }));

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

  return server;
}

const app = express();
app.use(express.json());

// Session store: sessionId → transport (for multi-turn sessions)
const sessions = new Map<string, StreamableHTTPServerTransport>();

// POST /mcp — initialize new session or route to existing one
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId) {
    const transport = sessions.get(sessionId);
    if (!transport) {
      res.status(400).json({ error: `Unknown session: ${sessionId}` });
      return;
    }
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session — create transport + server pair
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, transport);
    },
  });

  transport.onclose = () => {
    const id = (transport as StreamableHTTPServerTransport & { sessionId?: string }).sessionId;
    if (id) sessions.delete(id);
  };

  const server = buildServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// GET /mcp — SSE stream for server-sent events on existing session
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? sessions.get(sessionId) : undefined;
  if (!transport) {
    res.status(400).json({ error: "Invalid or missing mcp-session-id header" });
    return;
  }
  await transport.handleRequest(req, res);
});

// DELETE /mcp — clean up session
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId) {
    const transport = sessions.get(sessionId);
    if (transport) {
      await transport.close();
      sessions.delete(sessionId);
    }
  }
  res.status(200).end();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, version: "0.2.0", sessions: sessions.size });
});

app.listen(PORT, () => {
  console.error(`GuardEntry APR MCP server listening on http://localhost:${PORT}/mcp`);
  console.error(`Health: http://localhost:${PORT}/health`);
});
