const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type AgentStatus = "ACTIVE" | "PAUSED" | "REVOKED";

export type DecisionStatus = "ALLOWED" | "DENIED" | "APPROVAL_REQUIRED";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ReviewDecision = "APPROVED" | "REJECTED";

export type FinancialAgent = {
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

export type AgentPolicyInput = {
  transactionLimit: number;
  approvalThreshold: number;
  dailyBudget: number;
  allowedActions: string[];
};

export type SystemState = {
  id: number;
  emergencyStop: boolean;
  updatedAt: string;
};

export type PolicyDecision = {
  status: DecisionStatus;
  reason: string;
  policyCode: string;
};

export type ActionEvaluationRequest = {
  agentId: string;
  action: string;
  amount: number;
  customerId?: string;
};

export type ApprovalRequest = {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  amount: number;
  customerId: string | null;
  reason: string;
  status: ApprovalStatus;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type AuditEvent = {
  id: string;
  category:
    | "ACTION_EVALUATION"
    | "AGENT_STATUS_CHANGE"
    | "SYSTEM_CONTROL"
    | "APPROVAL_DECISION"
    | "POLICY_UPDATE";
  actor: string;
  agentId: string | null;
  agentName: string | null;
  action: string | null;
  amount: number | null;
  outcome: string;
  message: string;
  createdAt: string;
};

export type ActionEvaluation = {
  request: ActionEvaluationRequest;

  decision: PolicyDecision;

  agent: {
    id: string;
    name: string;
    status: AgentStatus;
  };

  budget: {
    dailyBudget: number;
    spentBefore: number;
    spentAfter: number;
    remainingBudget: number;
  };

  approvalRequest?: ApprovalRequest;
  evaluatedAt: string;
};

type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  message?: string;
};

type ApiErrorResponse = {
  success: false;
  message: string;
  policyCode?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly policyCode?: string;

  constructor(message: string, status: number, policyCode?: string) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.policyCode = policyCode;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,

    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  let responseBody: ApiSuccessResponse<T> | ApiErrorResponse;

  try {
    responseBody = (await response.json()) as
      ApiSuccessResponse<T> | ApiErrorResponse;
  } catch {
    throw new ApiError(
      "The server returned an invalid response.",
      response.status,
    );
  }

  if (!response.ok || responseBody.success === false) {
    const errorResponse = responseBody as ApiErrorResponse;

    throw new ApiError(
      errorResponse.message || "The request could not be completed.",
      response.status,
      errorResponse.policyCode,
    );
  }

  return responseBody.data;
}

export async function fetchAgents(): Promise<FinancialAgent[]> {
  return request<FinancialAgent[]>("/api/agents");
}

export async function updateAgentStatus(
  agentId: string,
  status: AgentStatus,
): Promise<{
  agent: FinancialAgent;
  previousStatus: AgentStatus;
  updatedAt: string;
}> {
  return request<{
    agent: FinancialAgent;
    previousStatus: AgentStatus;
    updatedAt: string;
  }>(`/api/agents/${encodeURIComponent(agentId)}/status`, {
    method: "PATCH",

    body: JSON.stringify({
      status,
    }),
  });
}

export async function updateAgentPolicy(
  agentId: string,
  policy: AgentPolicyInput,
): Promise<{
  agent: FinancialAgent;
  updatedAt: string;
}> {
  return request<{
    agent: FinancialAgent;
    updatedAt: string;
  }>(`/api/agents/${encodeURIComponent(agentId)}/policy`, {
    method: "PATCH",
    body: JSON.stringify(policy),
  });
}

export async function fetchSystemStatus(): Promise<SystemState> {
  return request<SystemState>("/api/system/status");
}

export async function activateEmergencyStop(): Promise<SystemState> {
  return request<SystemState>("/api/system/emergency-stop", {
    method: "POST",
  });
}

export async function resumeSystem(): Promise<SystemState> {
  return request<SystemState>("/api/system/resume", {
    method: "POST",
  });
}

export async function evaluateAgentAction(
  input: ActionEvaluationRequest,
): Promise<ActionEvaluation> {
  return request<ActionEvaluation>("/api/actions/evaluate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchApprovals(): Promise<ApprovalRequest[]> {
  return request<ApprovalRequest[]>("/api/approvals");
}

export async function reviewApproval(
  approvalId: string,
  decision: ReviewDecision,
  reviewedBy = "dashboard-supervisor",
): Promise<{
  approval: ApprovalRequest;

  budget: {
    dailyBudget: number;
    spentToday: number;
    remainingBudget: number;
  };
}> {
  return request<{
    approval: ApprovalRequest;

    budget: {
      dailyBudget: number;
      spentToday: number;
      remainingBudget: number;
    };
  }>(`/api/approvals/${encodeURIComponent(approvalId)}`, {
    method: "PATCH",

    body: JSON.stringify({
      decision,
      reviewedBy,
    }),
  });
}

export async function fetchAuditEvents(limit = 20): Promise<AuditEvent[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);

  return request<AuditEvent[]>(`/api/audit-events?limit=${safeLimit}`);
}
