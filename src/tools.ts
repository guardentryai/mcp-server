import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const tools: Tool[] = [
  {
    name: "guardentry_chat",
    description: "Send a natural language message to GuardEntry. Can query compliance data, create risks/controls/evidence, generate reports. Write actions are queued for dashboard approval.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Natural language instruction (e.g., 'Create a risk for unpatched servers' or 'What is our SOC 2 readiness?')",
        },
        conversation_id: {
          type: "string",
          description: "Optional conversation ID for multi-turn context",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "guardentry_list_risks",
    description: "List the organization's risk register. Returns risks with severity scores, status, and descriptions.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status: identified, assessed, mitigated, accepted, closed",
          enum: ["identified", "assessed", "mitigated", "accepted", "closed"],
        },
      },
    },
  },
  {
    name: "guardentry_compliance_status",
    description: "Get compliance readiness status for a specific framework or all frameworks.",
    inputSchema: {
      type: "object",
      properties: {
        framework: {
          type: "string",
          description: "Framework code: SOC2, ISO27001, NIST_CSF, HIPAA, PCI_DSS, AI_RMF",
        },
      },
    },
  },
  {
    name: "guardentry_list_pending",
    description: "List pending API actions awaiting dashboard approval.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status (default: pending_approval)",
          enum: ["pending_approval", "approved", "rejected", "failed"],
        },
      },
    },
  },
  {
    name: "guardentry_action_status",
    description: "Check the status of a specific API action by ID.",
    inputSchema: {
      type: "object",
      properties: {
        action_id: {
          type: "string",
          description: "The action UUID to check",
        },
      },
      required: ["action_id"],
    },
  },
  {
    name: "guardentry_invoke_agent",
    description: "Invoke a GuardEntry agent by ID or type. The agent executes its configured skills (vulnerability scanning, compliance checks, risk analysis, etc.) and returns results. Write actions are queued for dashboard approval.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "UUID of a specific agent to invoke",
        },
        agent_type: {
          type: "string",
          description: "Agent type to find and invoke (e.g., 'vulnerability', 'compliance', 'risk'). Used if agent_id not provided.",
        },
        prompt: {
          type: "string",
          description: "Optional additional instructions for this run",
        },
      },
    },
  },
  {
    name: "guardentry_invoke_skill",
    description: "Invoke a single GuardEntry skill directly (e.g., compliance_check, risk_analysis, scan_vulnerabilities). Read skills execute immediately; write skills are queued for approval.",
    inputSchema: {
      type: "object",
      properties: {
        skill_id: {
          type: "string",
          description: "The skill ID to invoke (e.g., 'compliance_check', 'risk_analysis', 'scan_vulnerabilities', 'policy_review')",
        },
        input: {
          type: "object",
          description: "Input parameters for the skill (varies by skill)",
        },
      },
      required: ["skill_id"],
    },
  },
  {
    name: "guardentry_list_skills",
    description: "List all available GuardEntry agent skills with descriptions, grouped by category (research, analysis, write, output).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "guardentry_evaluate_action",
    description: "Evaluate whether a proposed agent action is allowed, blocked, or requires approval based on the agent's policy. Returns a decision with reasoning. Use before any agent executes a sensitive task, tool call, or prompt.",
    inputSchema: {
      type: "object",
      properties: {
        subject_content: {
          type: "string",
          description: "The action text to evaluate (task description, tool argument, prompt, etc.)",
        },
        subject_type: {
          type: "string",
          description: "Type of subject being evaluated",
          enum: ["task", "tool_argument", "prompt", "plan", "tool_result"],
        },
        agent_id: {
          type: "string",
          description: "UUID of the agent proposing the action (optional)",
        },
        agent_type: {
          type: "string",
          description: "Agent type for policy lookup (e.g. 'compliance', 'vulnerability')",
        },
        agent_name: {
          type: "string",
          description: "Human-readable agent name (used for policy inference if no policy exists)",
        },
        agent_tools: {
          type: "array",
          items: { type: "string" },
          description: "Tools available to the agent (used for policy inference)",
        },
        mode: {
          type: "string",
          description: "Evaluation depth: fast (rules only), balanced (rules + LLM), strict (LLM with reasoning model)",
          enum: ["fast", "balanced", "strict"],
        },
        policy: {
          type: "object",
          description: "Inline policy object — when provided, skips store lookup entirely. Useful for testing policies without saving them.",
          properties: {
            blockedActions: { type: "array", items: { type: "string" } },
            allowedActions: { type: "array", items: { type: "string" } },
            sensitivePatterns: { type: "array", items: { type: "string" } },
            blockedTools: { type: "array", items: { type: "string" } },
            allowedTools: { type: "array", items: { type: "string" } },
            requireApprovalPatterns: { type: "array", items: { type: "string" } },
            riskTolerance: { type: "string", enum: ["low", "medium", "high"] },
            defaultMode: { type: "string", enum: ["fast", "balanced", "strict"] },
          },
        },
        policy_id: {
          type: "string",
          description: "Load a specific policy by ID from the store instead of the default cascade lookup",
        },
      },
      required: ["subject_content", "subject_type"],
    },
  },
  {
    name: "guardentry_get_agent_policy",
    description: "Retrieve the effective policy for an agent. If no explicit policy exists, returns the inferred default policy that was auto-generated for this agent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "UUID of the agent",
        },
        agent_type: {
          type: "string",
          description: "Agent type to look up (used if agent_id not provided)",
        },
        status: {
          type: "string",
          description: "Filter policies by status",
          enum: ["inferred", "confirmed", "modified"],
        },
      },
    },
  },
  {
    name: "guardentry_confirm_policy",
    description: "Confirm an inferred agent policy, making it the active confirmed policy. Use after reviewing an auto-generated policy to promote it from 'inferred' to 'confirmed'.",
    inputSchema: {
      type: "object",
      properties: {
        policy_id: {
          type: "string",
          description: "UUID of the policy to confirm",
        },
      },
      required: ["policy_id"],
    },
  },
  {
    name: "guardentry_update_policy",
    description: "Update an agent policy's rules — blocked actions, allowed tools, require-approval patterns, risk tolerance, and mode. A version snapshot is saved before each update.",
    inputSchema: {
      type: "object",
      properties: {
        policy_id: {
          type: "string",
          description: "UUID of the policy to update",
        },
        blocked_actions: {
          type: "array",
          items: { type: "string" },
          description: "New list of blocked action patterns",
        },
        allowed_actions: {
          type: "array",
          items: { type: "string" },
          description: "New list of explicitly allowed action patterns",
        },
        blocked_tools: {
          type: "array",
          items: { type: "string" },
          description: "New list of blocked tool names",
        },
        require_approval_patterns: {
          type: "array",
          items: { type: "string" },
          description: "New list of patterns that require human approval",
        },
        risk_tolerance: {
          type: "string",
          description: "Risk tolerance level",
          enum: ["low", "medium", "high"],
        },
        default_mode: {
          type: "string",
          description: "Default evaluation mode for this policy",
          enum: ["fast", "balanced", "strict"],
        },
        change_reason: {
          type: "string",
          description: "Reason for this policy update (recorded in version history)",
        },
      },
      required: ["policy_id"],
    },
  },
];

async function apiCall(
  method: string,
  path: string,
  apiKey: string,
  baseUrl: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as Record<string, string>).error || `API returned ${res.status}`);
  }

  return res.json();
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  apiKey: string,
  baseUrl: string
): Promise<unknown> {
  switch (name) {
    case "guardentry_chat": {
      return apiCall("POST", "/api/v1/chat", apiKey, baseUrl, {
        message: args.message,
        conversation_id: args.conversation_id,
      });
    }

    case "guardentry_list_risks": {
      const msg = args.status
        ? `List all ${args.status} risks`
        : "List all risks sorted by severity";
      return apiCall("POST", "/api/v1/chat", apiKey, baseUrl, { message: msg });
    }

    case "guardentry_compliance_status": {
      const msg = args.framework
        ? `What is our ${args.framework} compliance readiness status?`
        : "What is our overall compliance readiness across all frameworks?";
      return apiCall("POST", "/api/v1/chat", apiKey, baseUrl, { message: msg });
    }

    case "guardentry_list_pending": {
      const status = args.status || "pending_approval";
      return apiCall("GET", `/api/v1/actions?status=${status}`, apiKey, baseUrl);
    }

    case "guardentry_action_status": {
      if (!args.action_id) throw new Error("action_id is required");
      return apiCall("GET", `/api/v1/actions/${args.action_id}`, apiKey, baseUrl);
    }

    case "guardentry_invoke_agent": {
      return apiCall("POST", "/api/v1/agents/invoke", apiKey, baseUrl, {
        agent_id: args.agent_id,
        agent_type: args.agent_type,
        prompt: args.prompt,
      });
    }

    case "guardentry_invoke_skill": {
      if (!args.skill_id) throw new Error("skill_id is required");
      return apiCall("POST", "/api/v1/agents/invoke-skill", apiKey, baseUrl, {
        skill_id: args.skill_id,
        input: args.input || {},
      });
    }

    case "guardentry_list_skills": {
      return apiCall("GET", "/api/v1/agents/skills", apiKey, baseUrl);
    }

    case "guardentry_evaluate_action": {
      if (!args.subject_content || !args.subject_type) {
        throw new Error("subject_content and subject_type are required");
      }
      return apiCall("POST", "/api/v2/policy-router/evaluate", apiKey, baseUrl, {
        subject_content: args.subject_content,
        subject_type: args.subject_type,
        agent_id: args.agent_id,
        agent_type: args.agent_type,
        agent_name: args.agent_name,
        agent_tools: args.agent_tools,
        mode: args.mode ?? "balanced",
        ...(args.policy ? { policy: args.policy } : {}),
        ...(args.policy_id ? { policy_id: args.policy_id } : {}),
      });
    }

    case "guardentry_get_agent_policy": {
      const params = new URLSearchParams();
      if (args.agent_id) params.set("agent_id", String(args.agent_id));
      if (args.agent_type) params.set("agent_type", String(args.agent_type));
      if (args.status) params.set("status", String(args.status));
      return apiCall("GET", `/api/v1/policy-router/policies?${params}`, apiKey, baseUrl);
    }

    case "guardentry_confirm_policy": {
      if (!args.policy_id) throw new Error("policy_id is required");
      return apiCall("POST", `/api/v1/policy-router/policies/${args.policy_id}/confirm`, apiKey, baseUrl);
    }

    case "guardentry_update_policy": {
      if (!args.policy_id) throw new Error("policy_id is required");
      return apiCall("PUT", `/api/v1/policy-router/policies/${args.policy_id}`, apiKey, baseUrl, {
        blockedActions: args.blocked_actions,
        allowedActions: args.allowed_actions,
        blockedTools: args.blocked_tools,
        requireApprovalPatterns: args.require_approval_patterns,
        riskTolerance: args.risk_tolerance,
        defaultMode: args.default_mode,
        change_reason: args.change_reason,
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
