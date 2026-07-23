import { randomUUID } from "node:crypto";
import cors from "cors";
import express, {
  type Request,
  type Response,
} from "express";

type AgentStatus = "ACTIVE" | "PAUSED" | "REVOKED";

type DecisionStatus =
  | "ALLOWED"
  | "DENIED"
  | "APPROVAL_REQUIRED";

type AuditCategory =
  | "ACTION_EVALUATION"
  | "AGENT_STATUS_CHANGE"
  | "SYSTEM_CONTROL";

type FinancialAgent = {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  allowedActions: string[];
  transactionLimit: number;
  approvalThreshold: number;
  dailyBudget: number;
  spentToday: number;
};

type ActionRequest = {
  agentId: string;
  action: string;
  amount: number;
  customerId?: string;
};

type PolicyDecision = {
  status: DecisionStatus;
  reason: string;
  policyCode: string;
};

type SystemState = {
  emergencyStop: boolean;
  updatedAt: string;
};

type AuditEvent = {
  id: string;
  category: AuditCategory;
  actor: string;
  agentId?: string;
  agentName?: string;
  action?: string;
  amount?: number;
  outcome: string;
  message: string;
  createdAt: string;
};

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json());

const agents: FinancialAgent[] = [
  {
    id: "refund-agent",
    name: "Refund Agent",
    description: "Processes eligible customer refund requests.",
    status: "ACTIVE",
    allowedActions: [
      "VIEW_TRANSACTION",
      "ISSUE_REFUND",
    ],
    transactionLimit: 10000,
    approvalThreshold: 5000,
    dailyBudget: 50000,
    spentToday: 12000,
  },
  {
    id: "travel-agent",
    name: "Travel Booking Agent",
    description:
      "Books flights and hotels within approved limits.",
    status: "ACTIVE",
    allowedActions: [
      "BOOK_FLIGHT",
      "BOOK_HOTEL",
    ],
    transactionLimit: 25000,
    approvalThreshold: 15000,
    dailyBudget: 100000,
    spentToday: 30000,
  },
  {
    id: "servicing-agent",
    name: "Card Servicing Agent",
    description:
      "Handles fee waivers and card servicing requests.",
    status: "PAUSED",
    allowedActions: [
      "WAIVE_FEE",
      "REPLACE_CARD",
    ],
    transactionLimit: 5000,
    approvalThreshold: 2500,
    dailyBudget: 20000,
    spentToday: 4000,
  },
];

const systemState: SystemState = {
  emergencyStop: false,
  updatedAt: new Date().toISOString(),
};

const auditEvents: AuditEvent[] = [];

function evaluateAction(
  request: ActionRequest,
  agent: FinancialAgent,
): PolicyDecision {
  if (systemState.emergencyStop) {
    return {
      status: "DENIED",
      reason:
        "The fleet-wide emergency stop is active. All agent actions are blocked.",
      policyCode: "EMERGENCY_STOP_ACTIVE",
    };
  }

  if (agent.status === "REVOKED") {
    return {
      status: "DENIED",
      reason:
        "This agent has been revoked and cannot perform any action.",
      policyCode: "AGENT_REVOKED",
    };
  }

  if (agent.status === "PAUSED") {
    return {
      status: "DENIED",
      reason: "This agent is currently paused.",
      policyCode: "AGENT_PAUSED",
    };
  }

  if (!agent.allowedActions.includes(request.action)) {
    return {
      status: "DENIED",
      reason: `The agent does not have permission to perform ${request.action}.`,
      policyCode: "ACTION_NOT_PERMITTED",
    };
  }

  if (request.amount > agent.transactionLimit) {
    return {
      status: "DENIED",
      reason: `The requested amount exceeds the ₹${agent.transactionLimit.toLocaleString(
        "en-IN",
      )} transaction limit.`,
      policyCode: "TRANSACTION_LIMIT_EXCEEDED",
    };
  }

  if (
    agent.spentToday + request.amount >
    agent.dailyBudget
  ) {
    return {
      status: "DENIED",
      reason:
        "The action would exceed the agent's remaining daily budget.",
      policyCode: "DAILY_BUDGET_EXCEEDED",
    };
  }

  if (request.amount > agent.approvalThreshold) {
    return {
      status: "APPROVAL_REQUIRED",
      reason: `Actions above ₹${agent.approvalThreshold.toLocaleString(
        "en-IN",
      )} require supervisor approval.`,
      policyCode: "SUPERVISOR_APPROVAL_REQUIRED",
    };
  }

  return {
    status: "ALLOWED",
    reason:
      "The action satisfies all active governance policies.",
    policyCode: "ALL_POLICIES_PASSED",
  };
}

function recordAuditEvent(
  event: Omit<AuditEvent, "id" | "createdAt">,
): AuditEvent {
  const auditEvent: AuditEvent = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...event,
  };

  auditEvents.unshift(auditEvent);

  if (auditEvents.length > 100) {
    auditEvents.length = 100;
  }

  return auditEvent;
}

app.get(
  "/health",
  (_request: Request, response: Response) => {
    response.status(200).json({
      success: true,
      message: "AgentGuard backend is running",
    });
  },
);

app.get(
  "/api/agents",
  (_request: Request, response: Response) => {
    response.status(200).json({
      success: true,
      data: agents,
    });
  },
);

app.patch(
  "/api/agents/:agentId/status",
  (request: Request, response: Response) => {
    const agentId = request.params.agentId;

    const body = request.body as {
      status?: AgentStatus;
    };

    const validStatuses: AgentStatus[] = [
      "ACTIVE",
      "PAUSED",
      "REVOKED",
    ];

    if (
      typeof body.status !== "string" ||
      !validStatuses.includes(body.status)
    ) {
      response.status(400).json({
        success: false,
        message:
          "Status must be ACTIVE, PAUSED or REVOKED.",
      });

      return;
    }

    const agent = agents.find(
      (currentAgent) =>
        currentAgent.id === agentId,
    );

    if (!agent) {
      response.status(404).json({
        success: false,
        message: "Agent not found.",
      });

      return;
    }

    const previousStatus = agent.status;
    agent.status = body.status;

    recordAuditEvent({
      category: "AGENT_STATUS_CHANGE",
      actor: "dashboard-operator",
      agentId: agent.id,
      agentName: agent.name,
      outcome: body.status,
      message: `${agent.name} changed from ${previousStatus} to ${body.status}.`,
    });

    response.status(200).json({
      success: true,
      data: {
        agent,
        previousStatus,
        updatedAt: new Date().toISOString(),
      },
    });
  },
);

app.get(
  "/api/system/status",
  (_request: Request, response: Response) => {
    response.status(200).json({
      success: true,
      data: systemState,
    });
  },
);

app.post(
  "/api/system/emergency-stop",
  (_request: Request, response: Response) => {
    systemState.emergencyStop = true;
    systemState.updatedAt =
      new Date().toISOString();

    recordAuditEvent({
      category: "SYSTEM_CONTROL",
      actor: "dashboard-operator",
      outcome: "EMERGENCY_STOP_ACTIVATED",
      message:
        "Fleet-wide emergency stop was activated. All financial actions are blocked.",
    });

    response.status(200).json({
      success: true,
      message:
        "Fleet-wide emergency stop activated.",
      data: systemState,
    });
  },
);

app.post(
  "/api/system/resume",
  (_request: Request, response: Response) => {
    systemState.emergencyStop = false;
    systemState.updatedAt =
      new Date().toISOString();

    recordAuditEvent({
      category: "SYSTEM_CONTROL",
      actor: "dashboard-operator",
      outcome: "SYSTEM_RESUMED",
      message:
        "Financial agent operations were resumed after the emergency stop.",
    });

    response.status(200).json({
      success: true,
      message: "Agent operations resumed.",
      data: systemState,
    });
  },
);

app.post(
  "/api/actions/evaluate",
  (request: Request, response: Response) => {
    const body =
      request.body as Partial<ActionRequest>;

    if (
      typeof body.agentId !== "string" ||
      typeof body.action !== "string" ||
      typeof body.amount !== "number"
    ) {
      response.status(400).json({
        success: false,
        message:
          "agentId, action and amount are required.",
      });

      return;
    }

    if (
      !Number.isFinite(body.amount) ||
      body.amount <= 0
    ) {
      response.status(400).json({
        success: false,
        message:
          "Amount must be a valid number greater than zero.",
      });

      return;
    }

    const agent = agents.find(
      (currentAgent) =>
        currentAgent.id === body.agentId,
    );

    if (!agent) {
      response.status(404).json({
        success: false,
        message: "Agent not found.",
      });

      return;
    }

    const actionRequest: ActionRequest = {
      agentId: body.agentId,
      action: body.action,
      amount: body.amount,
      customerId: body.customerId,
    };

    const budgetBefore = agent.spentToday;

    const decision = evaluateAction(
      actionRequest,
      agent,
    );

    if (decision.status === "ALLOWED") {
      agent.spentToday += actionRequest.amount;
    }

    recordAuditEvent({
      category: "ACTION_EVALUATION",
      actor: agent.id,
      agentId: agent.id,
      agentName: agent.name,
      action: actionRequest.action,
      amount: actionRequest.amount,
      outcome: decision.status,
      message: decision.reason,
    });

    response.status(200).json({
      success: true,
      data: {
        request: actionRequest,
        decision,
        agent: {
          id: agent.id,
          name: agent.name,
          status: agent.status,
        },
        budget: {
          dailyBudget: agent.dailyBudget,
          spentBefore: budgetBefore,
          spentAfter: agent.spentToday,
          remainingBudget:
            agent.dailyBudget - agent.spentToday,
        },
        evaluatedAt: new Date().toISOString(),
      },
    });
  },
);

app.get(
  "/api/audit-events",
  (request: Request, response: Response) => {
    const requestedLimit = Number(
      request.query.limit ?? 20,
    );

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(requestedLimit, 50)
        : 20;

    response.status(200).json({
      success: true,
      data: auditEvents.slice(0, limit),
    });
  },
);

// Keep this 404 middleware below every valid route.
app.use(
  (_request: Request, response: Response) => {
    response.status(404).json({
      success: false,
      message: "Route not found",
    });
  },
);

app.listen(port, () => {
  console.log(
    `AgentGuard backend running at http://localhost:${port}`,
  );
});