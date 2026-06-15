"""
GuardEntry APR + CrewAI v2 — IT Change Request Review
=======================================================
A two-agent crew reviews a production change request and decides
whether it can be auto-approved or needs CAB (Change Advisory Board)
escalation. GuardEntry APR gates each agent's key action against your
change management policy before it executes — enforcing controls like
SOC 2 CC8.1 and ISO 27001 A.12.1.2 automatically.

Flow:
  1. Change Risk Analyst reviews the request → calls GuardEntry before
     writing the risk assessment
  2. Approval Coordinator issues the decision → calls GuardEntry before
     recommending auto-approve or CAB

GuardEntry is not the focus — it just ensures every action aligns with
policy before the agent commits to it.

Prerequisites:
  pip install crewai

  Start the MCP server (slim mode keeps Claude under the tool-schema limit):
    Windows:
      $env:GUARDENTRY_API_KEY="ge_k1_..."; $env:MCP_TOOLS="guardentry_evaluate_action"; npm run start:http
    Linux / macOS:
      MCP_TOOLS=guardentry_evaluate_action GUARDENTRY_API_KEY=ge_k1_... npm run start:http

  Then run:
    python test-crewai-v2.py
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
ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY")
MCP_URL            = os.environ.get("MCP_URL", "http://localhost:3001/mcp")

if not GUARDENTRY_API_KEY:
    print("Error: GUARDENTRY_API_KEY is required (ge_k1_...)")
    sys.exit(1)

if not ANTHROPIC_API_KEY:
    print("Error: ANTHROPIC_API_KEY is required")
    sys.exit(1)

# ── Change request being reviewed ─────────────────────────────────────────────
CHANGE_REQUEST = {
    "id":          "CHG-2847",
    "title":       "Add index to customers.email column — production PostgreSQL",
    "requestor":   "alice@acme.com",
    "environment": "production",
    "description": (
        "Add a non-unique index on customers.email to speed up login queries. "
        "Online DDL (no table lock). Estimated execution: 45 seconds. "
        "No data is modified. Rollback: DROP INDEX CONCURRENTLY idx_customers_email."
    ),
    "risk_stated":     "low",
    "change_window":   "Saturday 02:00–04:00 UTC",
    "has_rollback":    True,
    "tested_in_stage": True,
}

# ── GuardEntry MCP connection ─────────────────────────────────────────────────
mcp = MCPServerHTTP(
    url=MCP_URL,
    headers={"Authorization": f"Bearer {GUARDENTRY_API_KEY}"},
)

llm = LLM(
    model="anthropic/claude-haiku-4-5-20251001",
    api_key=ANTHROPIC_API_KEY,
)

# ── Agents ────────────────────────────────────────────────────────────────────

change_analyst = Agent(
    role="Change Risk Analyst",
    goal="Assess the technical risk and completeness of a proposed production change",
    backstory=(
        "You review production change requests for technical risk. You check "
        "whether the stated risk level is accurate, the rollback plan is viable, "
        "and the change window is appropriate. Before documenting your assessment, "
        "you call guardentry_evaluate_action to confirm the action aligns with "
        "the organisation's change management controls."
    ),
    mcps=[mcp],
    llm=llm,
    verbose=True,
)

approval_coordinator = Agent(
    role="Change Approval Coordinator",
    goal="Route a change request to the correct approval path",
    backstory=(
        "You decide whether a change can be auto-approved or must go to the "
        "Change Advisory Board (CAB). You lean on the risk analyst's findings "
        "and always call guardentry_evaluate_action before issuing your "
        "recommendation to ensure it is within policy bounds."
    ),
    mcps=[mcp],
    llm=llm,
    verbose=True,
)

# ── Tasks ─────────────────────────────────────────────────────────────────────

assess_risk = Task(
    description=f"""
Review the following change request:

  ID:           {CHANGE_REQUEST['id']}
  Title:        {CHANGE_REQUEST['title']}
  Environment:  {CHANGE_REQUEST['environment']}
  Description:  {CHANGE_REQUEST['description']}
  Stated risk:  {CHANGE_REQUEST['risk_stated']}
  Change window:{CHANGE_REQUEST['change_window']}
  Rollback:     {'Yes' if CHANGE_REQUEST['has_rollback'] else 'No'}
  Staged:       {'Yes — tested in staging' if CHANGE_REQUEST['tested_in_stage'] else 'No'}

Before writing your assessment, call guardentry_evaluate_action with:
  subject_content: "Document risk assessment for {CHANGE_REQUEST['id']}: {CHANGE_REQUEST['title']}"
  subject_type:    "task"
  agent_type:      "change-management"

Then produce a structured assessment covering:
  1. Impact (low / medium / high) — does the stated level match the actual risk?
  2. Blast radius — what breaks if it goes wrong?
  3. Rollback viability — is the rollback plan complete and fast enough?
  4. Change-window fit — is the timing appropriate?
  5. Recommendation — proceed as-is, adjust, or reject?
""",
    expected_output=(
        "GuardEntry APR decision + a structured risk assessment with the five "
        "points above and a clear proceed / adjust / reject recommendation."
    ),
    agent=change_analyst,
)

determine_approval = Task(
    description=f"""
Using the risk analyst's findings, determine the approval path for {CHANGE_REQUEST['id']}.

Before issuing your recommendation, call guardentry_evaluate_action with:
  subject_content: "Auto-approve {CHANGE_REQUEST['id']}: production database index on customers.email"
  subject_type:    "task"
  agent_type:      "change-management"

Then pick exactly one outcome:
  AUTO-APPROVE  — low risk, standard change, tested in staging, within change window
  CAB REVIEW    — medium/high risk, non-standard, outside change window, or missing rollback
  REJECT        — critical risk or clear policy violation

State the outcome on the first line, then a single sentence justification.
Include the GuardEntry decision (allow / block / require_approval) and its confidence score.
""",
    expected_output=(
        "Line 1: AUTO-APPROVE | CAB REVIEW | REJECT\n"
        "Line 2: One-sentence justification\n"
        "Line 3: GuardEntry decision — <decision> (confidence: <score>)"
    ),
    agent=approval_coordinator,
)

# ── Run ───────────────────────────────────────────────────────────────────────

crew = Crew(
    agents=[change_analyst, approval_coordinator],
    tasks=[assess_risk, determine_approval],
    verbose=True,
)

print()
print("=" * 64)
print("GuardEntry APR × CrewAI  —  IT Change Request Review")
print(f"  Change : {CHANGE_REQUEST['id']} — {CHANGE_REQUEST['title']}")
print(f"  MCP    : {MCP_URL}")
print("=" * 64)
print()

result = crew.kickoff()

print()
print("=" * 64)
print("FINAL OUTPUT")
print("=" * 64)
print(result)
