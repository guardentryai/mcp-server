# GuardEntry MCP Server

Model Context Protocol (MCP) server for [GuardEntry](https://guardentry.ai) — exposes the Agent Policy Router (APR) as MCP tools so any MCP-compatible AI agent can gate its actions through your compliance policy before executing them.

## Transports

| Transport | Entry point | Use with |
|---|---|---|
| **Streamable HTTP** | `npm run start:http` | CrewAI, LangChain, any HTTP MCP client |
| **stdio** | `npm start` | Claude Desktop, Cursor, VS Code Cline |

## Quick start

```bash
git clone https://github.com/guardentryai/mcp-server.git
cd mcp-server
npm install
```

Create a `.env` file (copy from `.env.example`):

```bash
GUARDENTRY_API_KEY=ge_k1_your_key_here
# GUARDENTRY_BASE_URL=https://app.guardentry.ai   # default
# MCP_PORT=3001                                    # default (HTTP mode only)
# MCP_TOOLS=guardentry_evaluate_action            # optional tool allowlist
```

Get an API key at [app.guardentry.ai](https://app.guardentry.ai) → Settings → API Keys.

### HTTP mode (CrewAI, LangChain, etc.)

```bash
npm run start:http
# GuardEntry APR MCP server listening on http://localhost:3001/mcp
# Health: http://localhost:3001/health
```

### stdio mode (Claude Desktop, Cursor)

```bash
npm start
```

Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "guardentry": {
      "command": "npx",
      "args": ["--yes", "guardentry-mcp"],
      "env": { "GUARDENTRY_API_KEY": "ge_k1_your_key_here" }
    }
  }
}
```

## Available tools

| Tool | Description |
|---|---|
| `guardentry_evaluate_action` | Evaluate a proposed action — returns `allow`, `block`, or `require_approval` with reasoning |
| `guardentry_chat` | Natural language interface to GuardEntry |
| `guardentry_list_risks` | Query the risk register |
| `guardentry_compliance_status` | Get framework readiness (SOC 2, ISO 27001, NIST CSF…) |
| `guardentry_invoke_agent` | Run a GuardEntry agent by ID or type |
| `guardentry_invoke_skill` | Call a single agent skill directly |
| `guardentry_list_skills` | List available skills |
| `guardentry_get_agent_policy` | Get the effective policy for an agent |
| `guardentry_confirm_policy` | Promote an inferred policy to confirmed |
| `guardentry_update_policy` | Update policy rules (blocked actions, allowed tools, approval patterns) |
| `guardentry_list_pending` | List actions awaiting dashboard approval |
| `guardentry_action_status` | Check the status of a specific action |

### Limiting tools (recommended for CrewAI + Claude)

Anthropic's API has a ~16-parameter union-type limit across all active tools. Use `MCP_TOOLS` to expose only what you need:

```bash
MCP_TOOLS=guardentry_evaluate_action npm run start:http
```

## CrewAI integration

```python
from crewai import Agent, Task, Crew, LLM
from crewai.mcp.config import MCPServerHTTP
import os

mcp = MCPServerHTTP(
    url="http://localhost:3001/mcp",
    headers={"Authorization": f"Bearer {os.environ['GUARDENTRY_API_KEY']}"},
)

agent = Agent(
    role="Compliance Analyst",
    goal="Gate every action through GuardEntry APR before executing",
    backstory="You check compliance policy before any sensitive operation.",
    mcps=[mcp],
    llm=LLM(model="anthropic/claude-haiku-4-5-20251001",
             api_key=os.environ["ANTHROPIC_API_KEY"]),
)
```

Run the smoke test:

```bash
GUARDENTRY_API_KEY=ge_k1_... ANTHROPIC_API_KEY=sk-ant-... python test-crewai.py
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GUARDENTRY_API_KEY` | *(required)* | API key from GuardEntry dashboard |
| `GUARDENTRY_BASE_URL` | `https://app.guardentry.ai` | Override for local/staging |
| `MCP_PORT` | `3001` | HTTP server port |
| `MCP_TOOLS` | *(all tools)* | Comma-separated tool allowlist |

## License

MIT — see [LICENSE](LICENSE)

## Links

- [GuardEntry](https://guardentry.ai)
- [Integration docs](https://app.guardentry.ai/integrations/crewai)
- [Dashboard setup](https://app.guardentry.ai/dashboard/integrations/setup/crewai)
