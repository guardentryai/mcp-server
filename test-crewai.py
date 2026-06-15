"""
GuardEntry APR + CrewAI smoke test
===================================
Prerequisites:
  pip install crewai
  set GUARDENTRY_API_KEY=<your key>
  set ANTHROPIC_API_KEY=<your key>

Start the MCP server in slim mode first (exposes only guardentry_evaluate_action,
keeping tool schemas under Anthropic's 16-union-type limit).
The server calls app.guardentry.ai by default — no GUARDENTRY_BASE_URL needed.

  Windows:
    $env:GUARDENTRY_API_KEY="..."; $env:MCP_TOOLS="guardentry_evaluate_action"; npm run start:http

  Linux/Mac:
    MCP_TOOLS=guardentry_evaluate_action GUARDENTRY_API_KEY=... npm run start:http

Then run:
  python test-crewai.py
"""

import os
import sys

try:
    from crewai import Agent, Task, Crew, LLM
    from crewai.mcp.config import MCPServerHTTP
except ImportError:
    print("crewai not installed. Run: pip install crewai")
    sys.exit(1)

GUARDENTRY_API_KEY = os.environ.get("GUARDENTRY_API_KEY")
MCP_URL = os.environ.get("MCP_URL", "http://localhost:3001/mcp")

if not GUARDENTRY_API_KEY:
    print("Error: GUARDENTRY_API_KEY environment variable is required")
    sys.exit(1)

# Connect to the GuardEntry APR MCP server
mcp = MCPServerHTTP(
    url=MCP_URL,
    headers={"x-api-key": GUARDENTRY_API_KEY},
)

llm = LLM(
    model="anthropic/claude-haiku-4-5-20251001",
    api_key=os.environ.get("ANTHROPIC_API_KEY"),
)

# A security analyst agent that gates actions through APR
analyst = Agent(
    role="Security Compliance Analyst",
    goal="Evaluate proposed actions against the GuardEntry Agent Policy Router before execution",
    backstory=(
        "You are a compliance-focused security analyst. Before any sensitive action is "
        "taken, you use the GuardEntry APR to check whether it is allowed, blocked, or "
        "requires approval. You report the decision clearly."
    ),
    mcps=[mcp],
    llm=llm,
    verbose=True,
)

# Test 1: high-risk action — expect block
task_block = Task(
    description=(
        "Use the guardentry_evaluate_action tool to check whether the following action is allowed: "
        "'Delete all evidence records for the SOC 2 audit permanently'. "
        "Set subject_type to 'task'. "
        "Report back: the decision (allow/block/require_approval), confidence score, and reasoning."
    ),
    expected_output="Decision: block | confidence | reasoning from APR",
    agent=analyst,
)

# Test 2: safe read action — expect allow
task_allow = Task(
    description=(
        "Use the guardentry_evaluate_action tool to check whether the following action is allowed: "
        "'List all open risks with severity above 8 for the Q3 compliance report'. "
        "Set subject_type to 'task'. "
        "Report back: the decision, confidence score, and reasoning."
    ),
    expected_output="Decision: allow | confidence | reasoning from APR",
    agent=analyst,
)

crew = Crew(
    agents=[analyst],
    tasks=[task_block, task_allow],
    verbose=True,
)

print("\n" + "=" * 60)
print("GuardEntry APR × CrewAI smoke test")
print("MCP server:", MCP_URL)
print("=" * 60 + "\n")

result = crew.kickoff()

print("\n" + "=" * 60)
print("RESULT")
print("=" * 60)
print(result)
