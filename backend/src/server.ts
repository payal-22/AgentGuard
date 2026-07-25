import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";

import { prisma } from "./lib/prisma";

type AgentStatus = "ACTIVE" | "PAUSED" | "REVOKED";

type DecisionStatus = "ALLOWED" | "DENIED" | "APPROVAL_REQUIRED";

type ReviewDecision = "APPROVED" | "REJECTED";

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
  budgetResetAt: string;
};

type FinancialAgentRecord = {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  transactionLimit: number;
  approvalThreshold: number;
  dailyBudget: number;
  spentToday: number;
  budgetResetAt: Date;

  allowedActions: Array<{
    action: string;
  }>;
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

type ApprovalAction = {
  action: string;
  amount: number;
};

type UnknownRecord = Record<string, unknown>;

type AsyncRouteHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

const app = express();

const requestedPort = Number(process.env.PORT ?? "4000");

const port =
  Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4000;

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

app.use(
  cors({
    origin: frontendOrigin,
  }),
);

app.use(express.json());

function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

function getRequestBody(value: unknown): UnknownRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as UnknownRecord;
  }

  return {};
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseAgentStatus(value: unknown): AgentStatus | null {
  if (value === "ACTIVE" || value === "PAUSED" || value === "REVOKED") {
    return value;
  }

  return null;
}

function parseReviewDecision(value: unknown): ReviewDecision | null {
  if (value === "APPROVED" || value === "REJECTED") {
    return value;
  }

  return null;
}
function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function parseAllowedActions(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const normalizedActions: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }

    const normalizedAction = item.trim().toUpperCase().replaceAll(" ", "_");

    if (!normalizedAction) {
      return null;
    }

    normalizedActions.push(normalizedAction);
  }

  return [...new Set(normalizedActions)];
}

function mapAgent(agent: FinancialAgentRecord): FinancialAgent {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    status: agent.status,

    allowedActions: agent.allowedActions.map((permission) => permission.action),

    transactionLimit: agent.transactionLimit,
    approvalThreshold: agent.approvalThreshold,
    dailyBudget: agent.dailyBudget,
    spentToday: agent.spentToday,
    budgetResetAt: agent.budgetResetAt.toISOString(),
  };
}

function getCurrentUtcDayStart(): Date {
  const now = new Date();

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

async function resetExpiredDailyBudgets(): Promise<void> {
  const currentDayStart = getCurrentUtcDayStart();

  const expiredAgents = await prisma.financialAgent.findMany({
    where: {
      budgetResetAt: {
        lt: currentDayStart,
      },
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (expiredAgents.length === 0) {
    return;
  }

  await prisma.$transaction(async (transaction) => {
    for (const expiredAgent of expiredAgents) {
      const currentAgent = await transaction.financialAgent.findUnique({
        where: {
          id: expiredAgent.id,
        },

        select: {
          id: true,
          name: true,
          budgetResetAt: true,
        },
      });

      if (!currentAgent || currentAgent.budgetResetAt >= currentDayStart) {
        continue;
      }

      const resetTime = new Date();

      await transaction.financialAgent.update({
        where: {
          id: currentAgent.id,
        },

        data: {
          spentToday: 0,
          budgetResetAt: resetTime,
        },
      });

      await transaction.auditEvent.create({
        data: {
          category: "SYSTEM_CONTROL",
          actor: "agentguard-system",
          agentName: currentAgent.name,
          outcome: "DAILY_BUDGET_RESET",

          message: `${currentAgent.name} daily spending was reset for a new UTC day.`,

          agent: {
            connect: {
              id: currentAgent.id,
            },
          },
        },
      });
    }
  });
}

function evaluateAction(
  request: ActionRequest,
  agent: FinancialAgent,
  emergencyStop: boolean,
): PolicyDecision {
  if (emergencyStop) {
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
      reason: "This agent has been revoked and cannot perform any action.",
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

  if (agent.spentToday + request.amount > agent.dailyBudget) {
    return {
      status: "DENIED",
      reason: "The action would exceed the agent's remaining daily budget.",
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
    reason: "The action satisfies all active governance policies.",
    policyCode: "ALL_POLICIES_PASSED",
  };
}

function validateApprovedAction(
  approval: ApprovalAction,
  agent: FinancialAgent,
  emergencyStop: boolean,
): PolicyDecision {
  if (emergencyStop) {
    return {
      status: "DENIED",
      reason: "The emergency stop is active. This approval cannot be executed.",
      policyCode: "EMERGENCY_STOP_ACTIVE",
    };
  }

  if (agent.status === "REVOKED") {
    return {
      status: "DENIED",
      reason: "The agent has been revoked. This approval cannot be executed.",
      policyCode: "AGENT_REVOKED",
    };
  }

  if (agent.status === "PAUSED") {
    return {
      status: "DENIED",
      reason: "The agent is paused. Activate it before approving this request.",
      policyCode: "AGENT_PAUSED",
    };
  }

  if (!agent.allowedActions.includes(approval.action)) {
    return {
      status: "DENIED",
      reason: "The agent no longer has permission to perform this action.",
      policyCode: "ACTION_NOT_PERMITTED",
    };
  }

  if (approval.amount > agent.transactionLimit) {
    return {
      status: "DENIED",
      reason: "The approval amount exceeds the agent transaction limit.",
      policyCode: "TRANSACTION_LIMIT_EXCEEDED",
    };
  }

  if (agent.spentToday + approval.amount > agent.dailyBudget) {
    return {
      status: "DENIED",
      reason: "Approving this request would exceed the remaining daily budget.",
      policyCode: "DAILY_BUDGET_EXCEEDED",
    };
  }

  return {
    status: "ALLOWED",
    reason:
      "The supervisor approved the request and all execution policies passed.",
    policyCode: "SUPERVISOR_APPROVAL_GRANTED",
  };
}

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get(
  "/health",
  asyncHandler(async (_request, response) => {
    await prisma.$queryRaw`SELECT 1`;

    response.status(200).json({
      success: true,
      message: "AgentGuard backend is running",
      database: "connected",
    });
  }),
);

/*
|--------------------------------------------------------------------------
| Agents
|--------------------------------------------------------------------------
*/

app.get(
  "/api/agents",
  asyncHandler(async (_request, response) => {
    await resetExpiredDailyBudgets();
    const agentRecords = await prisma.financialAgent.findMany({
      include: {
        allowedActions: {
          select: {
            action: true,
          },
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    });

    response.status(200).json({
      success: true,
      data: agentRecords.map(mapAgent),
    });
  }),
);

app.patch(
  "/api/agents/:agentId/status",
  asyncHandler(async (request, response) => {
    const agentId = getNonEmptyString(request.params.agentId);

    if (!agentId) {
      response.status(400).json({
        success: false,
        message: "A valid agent ID is required.",
      });

      return;
    }

    const body = getRequestBody(request.body);

    const requestedStatus = parseAgentStatus(body.status);

    if (!requestedStatus) {
      response.status(400).json({
        success: false,
        message: "Status must be ACTIVE, PAUSED or REVOKED.",
      });

      return;
    }

    const existingAgent = await prisma.financialAgent.findUnique({
      where: {
        id: agentId,
      },
    });

    if (!existingAgent) {
      response.status(404).json({
        success: false,
        message: "Agent not found.",
      });

      return;
    }

    const previousStatus = existingAgent.status;

    const updatedAgent = await prisma.$transaction(async (transaction) => {
      const agent = await transaction.financialAgent.update({
        where: {
          id: agentId,
        },

        data: {
          status: requestedStatus,
        },

        include: {
          allowedActions: {
            select: {
              action: true,
            },
          },
        },
      });

      await transaction.auditEvent.create({
        data: {
          category: "AGENT_STATUS_CHANGE",

          actor: "dashboard-operator",
          agentName: agent.name,
          outcome: requestedStatus,

          message: `${agent.name} changed from ${previousStatus} to ${requestedStatus}.`,

          agent: {
            connect: {
              id: agent.id,
            },
          },
        },
      });

      return agent;
    });

    response.status(200).json({
      success: true,

      data: {
        agent: mapAgent(updatedAgent),
        previousStatus,
        updatedAt: new Date().toISOString(),
      },
    });
  }),
);

app.patch(
  "/api/agents/:agentId/policy",
  asyncHandler(async (request, response) => {
    const agentId = getNonEmptyString(request.params.agentId);

    if (!agentId) {
      response.status(400).json({
        success: false,
        message: "A valid agent ID is required.",
      });

      return;
    }

    const body = getRequestBody(request.body);

    const transactionLimit = parsePositiveInteger(body.transactionLimit);

    const approvalThreshold = parsePositiveInteger(body.approvalThreshold);

    const dailyBudget = parsePositiveInteger(body.dailyBudget);

    const allowedActions = parseAllowedActions(body.allowedActions);

    if (transactionLimit === null) {
      response.status(400).json({
        success: false,
        message: "Transaction limit must be a positive whole number.",
      });

      return;
    }

    if (approvalThreshold === null) {
      response.status(400).json({
        success: false,
        message: "Approval threshold must be a positive whole number.",
      });

      return;
    }

    if (dailyBudget === null) {
      response.status(400).json({
        success: false,
        message: "Daily budget must be a positive whole number.",
      });

      return;
    }

    if (!allowedActions) {
      response.status(400).json({
        success: false,
        message: "At least one valid allowed action is required.",
      });

      return;
    }

    if (approvalThreshold > transactionLimit) {
      response.status(400).json({
        success: false,
        message: "Approval threshold cannot exceed the transaction limit.",
      });

      return;
    }
    await resetExpiredDailyBudgets();
    const existingAgent = await prisma.financialAgent.findUnique({
      where: {
        id: agentId,
      },
    });

    if (!existingAgent) {
      response.status(404).json({
        success: false,
        message: "Agent not found.",
      });

      return;
    }

    if (dailyBudget < existingAgent.spentToday) {
      response.status(409).json({
        success: false,

        message: `Daily budget cannot be lower than the agent's current spend of ₹${existingAgent.spentToday.toLocaleString(
          "en-IN",
        )}.`,
      });

      return;
    }

    const updatedAgent = await prisma.$transaction(async (transaction) => {
      const agent = await transaction.financialAgent.update({
        where: {
          id: agentId,
        },

        data: {
          transactionLimit,
          approvalThreshold,
          dailyBudget,

          allowedActions: {
            deleteMany: {},

            create: allowedActions.map((action) => ({
              action,
            })),
          },
        },

        include: {
          allowedActions: {
            select: {
              action: true,
            },
          },
        },
      });

      await transaction.auditEvent.create({
        data: {
          category: "POLICY_UPDATE",
          actor: "dashboard-operator",
          agentName: agent.name,
          outcome: "POLICY_UPDATED",

          message:
            `${agent.name} policy updated. ` +
            `Transaction limit: ₹${transactionLimit.toLocaleString(
              "en-IN",
            )}; ` +
            `approval threshold: ₹${approvalThreshold.toLocaleString(
              "en-IN",
            )}; ` +
            `daily budget: ₹${dailyBudget.toLocaleString("en-IN")}.`,

          agent: {
            connect: {
              id: agent.id,
            },
          },
        },
      });

      return agent;
    });

    response.status(200).json({
      success: true,
      message: "Agent policy updated successfully.",

      data: {
        agent: mapAgent(updatedAgent),
        updatedAt: new Date().toISOString(),
      },
    });
  }),
);

/*
|--------------------------------------------------------------------------
| System controls
|--------------------------------------------------------------------------
*/

app.get(
  "/api/system/status",
  asyncHandler(async (_request, response) => {
    const systemState = await prisma.systemState.upsert({
      where: {
        id: 1,
      },

      update: {},

      create: {
        id: 1,
        emergencyStop: false,
      },
    });

    response.status(200).json({
      success: true,
      data: systemState,
    });
  }),
);

app.post(
  "/api/system/emergency-stop",
  asyncHandler(async (_request, response) => {
    const systemState = await prisma.$transaction(async (transaction) => {
      const updatedState = await transaction.systemState.upsert({
        where: {
          id: 1,
        },

        update: {
          emergencyStop: true,
        },

        create: {
          id: 1,
          emergencyStop: true,
        },
      });

      await transaction.auditEvent.create({
        data: {
          category: "SYSTEM_CONTROL",
          actor: "dashboard-operator",

          outcome: "EMERGENCY_STOP_ACTIVATED",

          message:
            "Fleet-wide emergency stop was activated. All financial actions are blocked.",
        },
      });

      return updatedState;
    });

    response.status(200).json({
      success: true,

      message: "Fleet-wide emergency stop activated.",

      data: systemState,
    });
  }),
);

app.post(
  "/api/system/resume",
  asyncHandler(async (_request, response) => {
    const systemState = await prisma.$transaction(async (transaction) => {
      const updatedState = await transaction.systemState.upsert({
        where: {
          id: 1,
        },

        update: {
          emergencyStop: false,
        },

        create: {
          id: 1,
          emergencyStop: false,
        },
      });

      await transaction.auditEvent.create({
        data: {
          category: "SYSTEM_CONTROL",
          actor: "dashboard-operator",
          outcome: "SYSTEM_RESUMED",

          message:
            "Financial agent operations were resumed after the emergency stop.",
        },
      });

      return updatedState;
    });

    response.status(200).json({
      success: true,
      message: "Agent operations resumed.",
      data: systemState,
    });
  }),
);

/*
|--------------------------------------------------------------------------
| Action policy evaluation
|--------------------------------------------------------------------------
*/

app.post(
  "/api/actions/evaluate",
  asyncHandler(async (request, response) => {
    const body = getRequestBody(request.body);

    const agentId = getNonEmptyString(body.agentId);

    const action = getNonEmptyString(body.action);

    const amount = body.amount;

    if (!agentId || !action) {
      response.status(400).json({
        success: false,

        message: "agentId, action and amount are required.",
      });

      return;
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      response.status(400).json({
        success: false,

        message: "Amount must be a valid number greater than zero.",
      });

      return;
    }

    const customerId = getNonEmptyString(body.customerId);

    const actionRequest: ActionRequest = {
      agentId,
      action,
      amount,

      ...(customerId
        ? {
            customerId,
          }
        : {}),
    };
    await resetExpiredDailyBudgets();
    const evaluation = await prisma.$transaction(async (transaction) => {
      const agentRecord = await transaction.financialAgent.findUnique({
        where: {
          id: actionRequest.agentId,
        },

        include: {
          allowedActions: {
            select: {
              action: true,
            },
          },
        },
      });

      if (!agentRecord) {
        return null;
      }

      const systemState = await transaction.systemState.upsert({
        where: {
          id: 1,
        },

        update: {},

        create: {
          id: 1,
          emergencyStop: false,
        },
      });

      const agent = mapAgent(agentRecord);

      const decision = evaluateAction(
        actionRequest,
        agent,
        systemState.emergencyStop,
      );

      const spentBefore = agent.spentToday;

      let spentAfter = spentBefore;

      if (decision.status === "ALLOWED") {
        const updatedAgent = await transaction.financialAgent.update({
          where: {
            id: agent.id,
          },

          data: {
            spentToday: {
              increment: actionRequest.amount,
            },
          },

          select: {
            spentToday: true,
          },
        });

        spentAfter = updatedAgent.spentToday;
      }

      const approvalRequest =
        decision.status === "APPROVAL_REQUIRED"
          ? await transaction.approvalRequest.create({
              data: {
                agentName: agent.name,
                action: actionRequest.action,
                amount: actionRequest.amount,

                customerId: actionRequest.customerId ?? null,

                reason: decision.reason,

                agent: {
                  connect: {
                    id: agent.id,
                  },
                },
              },
            })
          : null;

      await transaction.auditEvent.create({
        data: {
          category: "ACTION_EVALUATION",

          actor: agent.id,
          agentName: agent.name,
          action: actionRequest.action,
          amount: actionRequest.amount,
          outcome: decision.status,
          message: decision.reason,

          agent: {
            connect: {
              id: agent.id,
            },
          },
        },
      });

      return {
        agent,
        decision,
        spentBefore,
        spentAfter,
        approvalRequest,
      };
    });

    if (!evaluation) {
      response.status(404).json({
        success: false,
        message: "Agent not found.",
      });

      return;
    }

    response.status(200).json({
      success: true,

      data: {
        request: actionRequest,
        decision: evaluation.decision,

        agent: {
          id: evaluation.agent.id,
          name: evaluation.agent.name,
          status: evaluation.agent.status,
        },

        budget: {
          dailyBudget: evaluation.agent.dailyBudget,

          spentBefore: evaluation.spentBefore,

          spentAfter: evaluation.spentAfter,

          remainingBudget: evaluation.agent.dailyBudget - evaluation.spentAfter,
        },

        ...(evaluation.approvalRequest
          ? {
              approvalRequest: evaluation.approvalRequest,
            }
          : {}),

        evaluatedAt: new Date().toISOString(),
      },
    });
  }),
);

/*
|--------------------------------------------------------------------------
| Audit events
|--------------------------------------------------------------------------
*/

app.get(
  "/api/audit-events",
  asyncHandler(async (request, response) => {
    const queryLimit =
      typeof request.query.limit === "string"
        ? Number(request.query.limit)
        : 20;

    const limit =
      Number.isInteger(queryLimit) && queryLimit > 0
        ? Math.min(queryLimit, 50)
        : 20;

    const auditEvents = await prisma.auditEvent.findMany({
      orderBy: {
        createdAt: "desc",
      },

      take: limit,
    });

    response.status(200).json({
      success: true,
      data: auditEvents,
    });
  }),
);

/*
|--------------------------------------------------------------------------
| Approval queue
|--------------------------------------------------------------------------
*/

app.get(
  "/api/approvals",
  asyncHandler(async (_request, response) => {
    const approvalRequests = await prisma.approvalRequest.findMany({
      orderBy: {
        requestedAt: "desc",
      },
    });

    response.status(200).json({
      success: true,
      data: approvalRequests,
    });
  }),
);

app.patch(
  "/api/approvals/:approvalId",
  asyncHandler(async (request, response) => {
    const approvalId = getNonEmptyString(request.params.approvalId);

    if (!approvalId) {
      response.status(400).json({
        success: false,

        message: "A valid approval request ID is required.",
      });

      return;
    }

    const body = getRequestBody(request.body);

    const requestedDecision = parseReviewDecision(body.decision);

    if (!requestedDecision) {
      response.status(400).json({
        success: false,

        message: "Decision must be APPROVED or REJECTED.",
      });

      return;
    }

    const reviewedBy =
      getNonEmptyString(body.reviewedBy) ?? "dashboard-supervisor";
    await resetExpiredDailyBudgets();

    const reviewResult = await prisma.$transaction(async (transaction) => {
      const approval = await transaction.approvalRequest.findUnique({
        where: {
          id: approvalId,
        },
      });

      if (!approval) {
        return {
          type: "APPROVAL_NOT_FOUND",
        } as const;
      }

      if (approval.status !== "PENDING") {
        return {
          type: "ALREADY_REVIEWED",
          status: approval.status,
        } as const;
      }

      const agentRecord = await transaction.financialAgent.findUnique({
        where: {
          id: approval.agentId,
        },

        include: {
          allowedActions: {
            select: {
              action: true,
            },
          },
        },
      });

      if (!agentRecord) {
        return {
          type: "AGENT_NOT_FOUND",
        } as const;
      }

      const systemState = await transaction.systemState.upsert({
        where: {
          id: 1,
        },

        update: {},

        create: {
          id: 1,
          emergencyStop: false,
        },
      });

      const agent = mapAgent(agentRecord);

      let spentToday = agent.spentToday;

      if (requestedDecision === "APPROVED") {
        const executionDecision = validateApprovedAction(
          approval,
          agent,
          systemState.emergencyStop,
        );

        if (executionDecision.status === "DENIED") {
          return {
            type: "EXECUTION_BLOCKED",
            decision: executionDecision,
          } as const;
        }

        const updatedAgent = await transaction.financialAgent.update({
          where: {
            id: agent.id,
          },

          data: {
            spentToday: {
              increment: approval.amount,
            },
          },

          select: {
            spentToday: true,
          },
        });

        spentToday = updatedAgent.spentToday;
      }

      const updatedApproval = await transaction.approvalRequest.update({
        where: {
          id: approval.id,
        },

        data: {
          status: requestedDecision,

          reviewedAt: new Date(),
          reviewedBy,
        },
      });

      await transaction.auditEvent.create({
        data: {
          category: "APPROVAL_DECISION",

          actor: reviewedBy,
          agentName: agent.name,
          action: approval.action,
          amount: approval.amount,

          outcome: requestedDecision,

          message:
            requestedDecision === "APPROVED"
              ? `${agent.name} request was approved and executed.`
              : `${agent.name} request was rejected by the supervisor.`,

          agent: {
            connect: {
              id: agent.id,
            },
          },
        },
      });

      return {
        type: "SUCCESS",

        approval: updatedApproval,

        budget: {
          dailyBudget: agent.dailyBudget,

          spentToday,

          remainingBudget: agent.dailyBudget - spentToday,
        },
      } as const;
    });

    if (reviewResult.type === "APPROVAL_NOT_FOUND") {
      response.status(404).json({
        success: false,

        message: "Approval request not found.",
      });

      return;
    }

    if (reviewResult.type === "ALREADY_REVIEWED") {
      response.status(409).json({
        success: false,

        message: `This request has already been ${reviewResult.status.toLowerCase()}.`,
      });

      return;
    }

    if (reviewResult.type === "AGENT_NOT_FOUND") {
      response.status(404).json({
        success: false,

        message: "The agent associated with this request was not found.",
      });

      return;
    }

    if (reviewResult.type === "EXECUTION_BLOCKED") {
      response.status(409).json({
        success: false,
        message: reviewResult.decision.reason,

        policyCode: reviewResult.decision.policyCode,
      });

      return;
    }

    response.status(200).json({
      success: true,

      message:
        requestedDecision === "APPROVED"
          ? "Approval request approved and executed."
          : "Approval request rejected.",

      data: {
        approval: reviewResult.approval,

        budget: reviewResult.budget,
      },
    });
  }),
);
app.get(
  "/api/analytics/summary",
  asyncHandler(async (_request, response) => {
    const [evaluationEvents, approvalRecords] = await Promise.all([
      prisma.auditEvent.findMany({
        where: {
          category: "ACTION_EVALUATION",
        },

        select: {
          agentId: true,
          agentName: true,
          outcome: true,
          amount: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      }),

      prisma.approvalRequest.findMany({
        select: {
          status: true,
        },
      }),
    ]);

    const totalEvaluations = evaluationEvents.length;

    const allowed = evaluationEvents.filter(
      (event) => event.outcome === "ALLOWED",
    ).length;

    const denied = evaluationEvents.filter(
      (event) => event.outcome === "DENIED",
    ).length;

    const approvalRequired = evaluationEvents.filter(
      (event) => event.outcome === "APPROVAL_REQUIRED",
    ).length;

    const evaluatedAmount = evaluationEvents.reduce(
      (total, event) => total + (event.amount ?? 0),
      0,
    );

    function calculateRate(count: number): number {
      if (totalEvaluations === 0) {
        return 0;
      }

      return Number(((count / totalEvaluations) * 100).toFixed(1));
    }

    type AgentAnalytics = {
      agentId: string;
      agentName: string;
      evaluations: number;
      allowed: number;
      denied: number;
      approvalRequired: number;
      evaluatedAmount: number;
    };

    const agentAnalytics = new Map<string, AgentAnalytics>();

    for (const event of evaluationEvents) {
      const agentId = event.agentId ?? "unknown-agent";

      const existing = agentAnalytics.get(agentId) ?? {
        agentId,
        agentName: event.agentName ?? "Unknown Agent",
        evaluations: 0,
        allowed: 0,
        denied: 0,
        approvalRequired: 0,
        evaluatedAmount: 0,
      };

      existing.evaluations += 1;
      existing.evaluatedAmount += event.amount ?? 0;

      if (event.outcome === "ALLOWED") {
        existing.allowed += 1;
      }

      if (event.outcome === "DENIED") {
        existing.denied += 1;
      }

      if (event.outcome === "APPROVAL_REQUIRED") {
        existing.approvalRequired += 1;
      }

      agentAnalytics.set(agentId, existing);
    }

    const pendingApprovals = approvalRecords.filter(
      (approval) => approval.status === "PENDING",
    ).length;

    const approvedApprovals = approvalRecords.filter(
      (approval) => approval.status === "APPROVED",
    ).length;

    const rejectedApprovals = approvalRecords.filter(
      (approval) => approval.status === "REJECTED",
    ).length;

    response.status(200).json({
      success: true,

      data: {
        totals: {
          evaluations: totalEvaluations,
          allowed,
          denied,
          approvalRequired,
          evaluatedAmount,
        },

        rates: {
          allowed: calculateRate(allowed),
          denied: calculateRate(denied),

          approvalRequired: calculateRate(approvalRequired),
        },

        approvals: {
          pending: pendingApprovals,
          approved: approvedApprovals,
          rejected: rejectedApprovals,
        },

        byAgent: Array.from(agentAnalytics.values()).sort(
          (firstAgent, secondAgent) =>
            secondAgent.evaluations - firstAgent.evaluations,
        ),

        generatedAt: new Date().toISOString(),
      },
    });
  }),
);

/*
|--------------------------------------------------------------------------
| 404 handler
|--------------------------------------------------------------------------
*/

app.use((_request: Request, response: Response) => {
  response.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

/*
|--------------------------------------------------------------------------
| Global error handler
|--------------------------------------------------------------------------
*/

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    console.error("Unhandled backend error:", error);

    response.status(500).json({
      success: false,

      message: "An unexpected server error occurred.",
    });
  },
);

/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

app.listen(port, () => {
  console.log(`AgentGuard backend running at http://localhost:${port}`);
});
