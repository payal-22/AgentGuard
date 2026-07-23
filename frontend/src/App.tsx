import { useEffect, useState, type FormEvent } from "react";
import "./App.css";

type AgentStatus = "ACTIVE" | "PAUSED" | "REVOKED";

type DecisionStatus = "ALLOWED" | "DENIED" | "APPROVAL_REQUIRED";

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

type PolicyDecision = {
  status: DecisionStatus;
  reason: string;
  policyCode: string;
};

type AgentsResponse = {
  success: boolean;
  data: FinancialAgent[];
};

type EvaluationResponse = {
  success: boolean;
  data: {
    request: {
      agentId: string;
      action: string;
      amount: number;
      customerId?: string;
    };
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
};
type SystemStatus = {
  emergencyStop: boolean;
  updatedAt: string;
};

type SystemStatusResponse = {
  success: boolean;
  data: SystemStatus;
};
type AuditCategory =
  | "ACTION_EVALUATION"
  | "AGENT_STATUS_CHANGE"
  | "SYSTEM_CONTROL"
  | "APPROVAL_DECISION";
type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

type ApprovalRequest = {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  amount: number;
  customerId?: string;
  reason: string;
  status: ApprovalStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

type ApprovalsResponse = {
  success: boolean;
  data: ApprovalRequest[];
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

type AuditEventsResponse = {
  success: boolean;
  data: AuditEvent[];
};

const API_URL = import.meta.env.VITE_API_URL as string;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatActionName(action: string): string {
  return action
    .split("_")
    .map((word) => {
      return word.charAt(0) + word.slice(1).toLowerCase();
    })
    .join(" ");
}
function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAuditCategory(category: AuditCategory): string {
  return category
    .split("_")
    .map((word) => {
      return word.charAt(0) + word.slice(1).toLowerCase();
    })
    .join(" ");
}

async function fetchAgents(): Promise<FinancialAgent[]> {
  const response = await fetch(`${API_URL}/api/agents`);

  if (!response.ok) {
    throw new Error(`Unable to load agents. Status: ${response.status}`);
  }

  const result = (await response.json()) as AgentsResponse;

  if (!result.success) {
    throw new Error("The API could not return the agents.");
  }

  return result.data;
}
async function fetchSystemStatus(): Promise<SystemStatus> {
  const response = await fetch(`${API_URL}/api/system/status`);

  if (!response.ok) {
    throw new Error(`Unable to load system status. Status: ${response.status}`);
  }

  const result = (await response.json()) as SystemStatusResponse;

  if (!result.success) {
    throw new Error("The API could not return system status.");
  }

  return result.data;
}
async function fetchAuditEvents(): Promise<AuditEvent[]> {
  const response = await fetch(`${API_URL}/api/audit-events?limit=20`);

  if (!response.ok) {
    throw new Error(`Unable to load audit events. Status: ${response.status}`);
  }

  const result = (await response.json()) as AuditEventsResponse;

  if (!result.success) {
    throw new Error("The API could not return audit events.");
  }

  return result.data;
}
async function fetchApprovals(): Promise<ApprovalRequest[]> {
  const response = await fetch(`${API_URL}/api/approvals`);

  if (!response.ok) {
    throw new Error(`Unable to load approvals. Status: ${response.status}`);
  }

  const result = (await response.json()) as ApprovalsResponse;

  if (!result.success) {
    throw new Error("The API could not return approval requests.");
  }

  return result.data;
}

function App() {
  const [agents, setAgents] = useState<FinancialAgent[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(
    [],
  );

  const [approvalError, setApprovalError] = useState("");

  const [reviewingApprovalId, setReviewingApprovalId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const [controlError, setControlError] = useState("");
  const [isControlLoading, setIsControlLoading] = useState(false);

  const [selectedAgentId, setSelectedAgentId] = useState("refund-agent");

  const [selectedAction, setSelectedAction] = useState("ISSUE_REFUND");

  const [amount, setAmount] = useState("2000");
  const [customerId, setCustomerId] = useState("CM-1001");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");

  const [evaluationResult, setEvaluationResult] = useState<
    EvaluationResponse["data"] | null
  >(null);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

  useEffect(() => {
    let isCancelled = false;

    Promise.all([
      fetchAgents(),
      fetchSystemStatus(),
      fetchAuditEvents(),
      fetchApprovals(),
    ])
      .then(([agentData, statusData, auditData, approvalData]) => {
        if (!isCancelled) {
          setAgents(agentData);
          setSystemStatus(statusData);
          setAuditEvents(auditData);
          setApprovalRequests(approvalData);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.";

          setLoadError(message);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  function handleAgentChange(agentId: string): void {
    setSelectedAgentId(agentId);
    setEvaluationResult(null);
    setEvaluationError("");

    const newAgent = agents.find((agent) => agent.id === agentId);

    if (newAgent && newAgent.allowedActions.length > 0) {
      setSelectedAction(newAgent.allowedActions[0]);
    }
  }
  async function refreshDashboard(): Promise<void> {
    const [agentData, statusData, auditData, approvalData] = await Promise.all([
      fetchAgents(),
      fetchSystemStatus(),
      fetchAuditEvents(),
      fetchApprovals(),
    ]);

    setAgents(agentData);
    setSystemStatus(statusData);
    setAuditEvents(auditData);
    setApprovalRequests(approvalData);
  }

  async function changeAgentStatus(
    agentId: string,
    status: AgentStatus,
  ): Promise<void> {
    try {
      setIsControlLoading(true);
      setControlError("");

      const response = await fetch(`${API_URL}/api/agents/${agentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to update agent status.");
      }

      await refreshDashboard();
      setEvaluationResult(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      setControlError(message);
    } finally {
      setIsControlLoading(false);
    }
  }

  async function changeEmergencyStop(shouldStop: boolean): Promise<void> {
    const confirmed = shouldStop
      ? window.confirm(
          "Activate the fleet-wide emergency stop? All agents will be blocked.",
        )
      : true;

    if (!confirmed) {
      return;
    }

    try {
      setIsControlLoading(true);
      setControlError("");

      const endpoint = shouldStop
        ? "/api/system/emergency-stop"
        : "/api/system/resume";

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
      });

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to update system status.");
      }

      await refreshDashboard();
      setEvaluationResult(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      setControlError(message);
    } finally {
      setIsControlLoading(false);
    }
  }
  async function reviewApproval(
    approvalId: string,
    decision: "APPROVED" | "REJECTED",
  ): Promise<void> {
    const confirmed = window.confirm(
      decision === "APPROVED"
        ? "Approve and execute this financial action?"
        : "Reject this financial action?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setReviewingApprovalId(approvalId);
      setApprovalError("");

      const response = await fetch(`${API_URL}/api/approvals/${approvalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          reviewedBy: "Yash",
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to review approval request.");
      }

      await refreshDashboard();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      setApprovalError(message);
    } finally {
      setReviewingApprovalId(null);
    }
  }
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const numericAmount = Number(amount);

    if (!selectedAgentId) {
      setEvaluationError("Please select an agent.");
      return;
    }

    if (!selectedAction) {
      setEvaluationError("Please select an action.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setEvaluationError("Amount must be greater than zero.");
      return;
    }

    try {
      setIsSubmitting(true);
      setEvaluationError("");
      setEvaluationResult(null);

      const response = await fetch(`${API_URL}/api/actions/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: selectedAgentId,
          action: selectedAction,
          amount: numericAmount,
          customerId: customerId.trim() || undefined,
        }),
      });

      const result = (await response.json()) as
        | EvaluationResponse
        | {
            success: false;
            message: string;
          };

      if (!response.ok || !result.success) {
        const message =
          "message" in result
            ? result.message
            : "The action could not be evaluated.";

        throw new Error(message);
      }

      setEvaluationResult(result.data);

      await refreshDashboard();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      setEvaluationError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Financial AI Governance</p>
          <h1>AgentGuard</h1>

          <p className="subtitle">
            Monitor permissions, budgets and operational status for autonomous
            financial agents.
          </p>
        </div>

        <div
          className={`system-status ${
            systemStatus?.emergencyStop ? "system-status-stopped" : ""
          }`}
        >
          <span
            className={`status-dot ${
              systemStatus?.emergencyStop ? "status-dot-stopped" : ""
            }`}
          />

          {systemStatus?.emergencyStop
            ? "Emergency stop active"
            : "System operational"}
        </div>
      </header>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Total Agents</span>
          <strong>{agents.length}</strong>
        </article>
        <article className="metric-card">
          <span>Pending Approvals</span>

          <strong>
            {
              approvalRequests.filter(
                (approval) => approval.status === "PENDING",
              ).length
            }
          </strong>
        </article>
        <article className="metric-card">
          <span>Active Agents</span>

          <strong>
            {agents.filter((agent) => agent.status === "ACTIVE").length}
          </strong>
        </article>

        <article className="metric-card">
          <span>Total Spend Today</span>

          <strong>
            {formatCurrency(
              agents.reduce((total, agent) => total + agent.spentToday, 0),
            )}
          </strong>
        </article>
      </section>
      <section
        className={`emergency-panel ${
          systemStatus?.emergencyStop ? "emergency-panel-active" : ""
        }`}
      >
        <div>
          <span className="emergency-eyebrow">Fleet safety control</span>

          <h2>
            {systemStatus?.emergencyStop
              ? "All financial agents are stopped"
              : "Agent fleet is operational"}
          </h2>

          <p>
            {systemStatus?.emergencyStop
              ? "Every new financial action will be denied until operations are resumed."
              : "Use the emergency stop only when the agent fleet presents an immediate risk."}
          </p>
        </div>

        {systemStatus?.emergencyStop ? (
          <button
            className="resume-button"
            type="button"
            disabled={isControlLoading}
            onClick={() => {
              void changeEmergencyStop(false);
            }}
          >
            Resume All Agents
          </button>
        ) : (
          <button
            className="emergency-button"
            type="button"
            disabled={isControlLoading}
            onClick={() => {
              void changeEmergencyStop(true);
            }}
          >
            Emergency Stop
          </button>
        )}
      </section>

      {controlError && (
        <div className="message-card error-card control-error">
          <strong>Control action failed</strong>
          <span>{controlError}</span>
        </div>
      )}

      <section className="simulator-section">
        <div className="section-heading">
          <div>
            <h2>Agent Simulator</h2>

            <p>
              Submit a financial action and evaluate it against the active
              governance policies.
            </p>
          </div>
        </div>

        <div className="simulator-layout">
          <form className="simulator-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="agent">Financial agent</label>

              <select
                id="agent"
                value={selectedAgentId}
                onChange={(event) => {
                  handleAgentChange(event.target.value);
                }}
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} — {agent.status}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="action">Requested action</label>

              <select
                id="action"
                value={selectedAction}
                onChange={(event) => {
                  setSelectedAction(event.target.value);
                  setEvaluationResult(null);
                }}
              >
                {selectedAgent?.allowedActions.map((action) => (
                  <option key={action} value={action}>
                    {formatActionName(action)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="amount">Amount</label>

                <input
                  id="amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setEvaluationResult(null);
                  }}
                  placeholder="Enter amount"
                />
              </div>

              <div className="form-group">
                <label htmlFor="customerId">Customer ID</label>

                <input
                  id="customerId"
                  type="text"
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                  }}
                  placeholder="CM-1001"
                />
              </div>
            </div>

            {selectedAgent && (
              <div className="policy-preview">
                <div>
                  <span>Transaction limit</span>

                  <strong>
                    {formatCurrency(selectedAgent.transactionLimit)}
                  </strong>
                </div>

                <div>
                  <span>Approval above</span>

                  <strong>
                    {formatCurrency(selectedAgent.approvalThreshold)}
                  </strong>
                </div>

                <div>
                  <span>Remaining budget</span>

                  <strong>
                    {formatCurrency(
                      selectedAgent.dailyBudget - selectedAgent.spentToday,
                    )}
                  </strong>
                </div>
              </div>
            )}

            {evaluationError && (
              <div className="form-error">{evaluationError}</div>
            )}

            <button
              className="evaluate-button"
              type="submit"
              disabled={isSubmitting || agents.length === 0}
            >
              {isSubmitting ? "Evaluating action..." : "Evaluate Action"}
            </button>
          </form>

          <div className="result-panel">
            {!evaluationResult && (
              <div className="empty-result">
                <span className="empty-result-icon">⚡</span>

                <h3>No action evaluated yet</h3>

                <p>
                  Select an agent, action and amount to see the policy decision.
                </p>
              </div>
            )}

            {evaluationResult && (
              <article
                className={`decision-card decision-${evaluationResult.decision.status
                  .toLowerCase()
                  .replaceAll("_", "-")}`}
              >
                <span className="decision-label">Policy decision</span>

                <h3>{evaluationResult.decision.status.replaceAll("_", " ")}</h3>

                <p>{evaluationResult.decision.reason}</p>

                <div className="decision-details">
                  <div>
                    <span>Agent</span>
                    <strong>{evaluationResult.agent.name}</strong>
                  </div>

                  <div>
                    <span>Action</span>
                    <strong>
                      {formatActionName(evaluationResult.request.action)}
                    </strong>
                  </div>

                  <div>
                    <span>Amount</span>
                    <strong>
                      {formatCurrency(evaluationResult.request.amount)}
                    </strong>
                  </div>

                  <div>
                    <span>Policy code</span>
                    <strong>{evaluationResult.decision.policyCode}</strong>
                  </div>

                  <div>
                    <span>Spend before</span>
                    <strong>
                      {formatCurrency(evaluationResult.budget.spentBefore)}
                    </strong>
                  </div>

                  <div>
                    <span>Spend after</span>
                    <strong>
                      {formatCurrency(evaluationResult.budget.spentAfter)}
                    </strong>
                  </div>
                </div>
              </article>
            )}
          </div>
        </div>
      </section>
      <section className="approval-section">
        <div className="section-heading">
          <div>
            <h2>Human Approval Queue</h2>

            <p>
              Review financial actions that exceeded an agent’s automatic
              approval threshold.
            </p>
          </div>

          <span className="approval-count">
            {
              approvalRequests.filter(
                (approval) => approval.status === "PENDING",
              ).length
            }{" "}
            pending
          </span>
        </div>

        {approvalError && (
          <div className="message-card error-card">
            <strong>Approval action failed</strong>
            <span>{approvalError}</span>
          </div>
        )}

        {approvalRequests.length === 0 ? (
          <div className="message-card">
            No approval requests have been created yet.
          </div>
        ) : (
          <div className="approval-grid">
            {approvalRequests.map((approval) => (
              <article className="approval-card" key={approval.id}>
                <div className="approval-card-header">
                  <div>
                    <span className="approval-eyebrow">Supervisor review</span>

                    <h3>{approval.agentName}</h3>
                  </div>

                  <span
                    className={`approval-status approval-status-${approval.status.toLowerCase()}`}
                  >
                    {approval.status}
                  </span>
                </div>

                <div className="approval-amount">
                  {formatCurrency(approval.amount)}
                </div>

                <div className="approval-details">
                  <div>
                    <span>Action</span>
                    <strong>{formatActionName(approval.action)}</strong>
                  </div>

                  <div>
                    <span>Customer</span>
                    <strong>{approval.customerId ?? "Not provided"}</strong>
                  </div>

                  <div>
                    <span>Requested</span>
                    <strong>{formatDateTime(approval.requestedAt)}</strong>
                  </div>

                  <div>
                    <span>Reviewed by</span>
                    <strong>{approval.reviewedBy ?? "Awaiting review"}</strong>
                  </div>
                </div>

                <p className="approval-reason">{approval.reason}</p>

                {approval.status === "PENDING" && (
                  <div className="approval-actions">
                    <button
                      className="approval-reject-button"
                      type="button"
                      disabled={reviewingApprovalId !== null}
                      onClick={() => {
                        void reviewApproval(approval.id, "REJECTED");
                      }}
                    >
                      {reviewingApprovalId === approval.id
                        ? "Processing..."
                        : "Reject"}
                    </button>

                    <button
                      className="approval-approve-button"
                      type="button"
                      disabled={reviewingApprovalId !== null}
                      onClick={() => {
                        void reviewApproval(approval.id, "APPROVED");
                      }}
                    >
                      {reviewingApprovalId === approval.id
                        ? "Processing..."
                        : "Approve & Execute"}
                    </button>
                  </div>
                )}

                {approval.status !== "PENDING" && (
                  <div className="approval-completed">
                    {approval.status === "APPROVED"
                      ? "This action was approved and executed."
                      : "This action was rejected and was not executed."}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-heading">
          <div>
            <h2>Managed Agents</h2>

            <p>Current governance configuration for each financial agent.</p>
          </div>
        </div>

        {isLoading && <div className="message-card">Loading agents…</div>}

        {loadError && (
          <div className="message-card error-card">
            <strong>Unable to load agents</strong>
            <span>{loadError}</span>
          </div>
        )}

        {!isLoading && !loadError && (
          <div className="agent-grid">
            {agents.map((agent) => {
              const budgetPercentage = Math.min(
                Math.round((agent.spentToday / agent.dailyBudget) * 100),
                100,
              );

              return (
                <article className="agent-card" key={agent.id}>
                  <div className="agent-card-header">
                    <div>
                      <h3>{agent.name}</h3>
                      <p>{agent.description}</p>
                    </div>

                    <span
                      className={`status-badge status-${agent.status.toLowerCase()}`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  <div className="agent-details">
                    <div>
                      <span>Transaction limit</span>

                      <strong>{formatCurrency(agent.transactionLimit)}</strong>
                    </div>

                    <div>
                      <span>Approval threshold</span>

                      <strong>{formatCurrency(agent.approvalThreshold)}</strong>
                    </div>

                    <div>
                      <span>Daily budget</span>

                      <strong>{formatCurrency(agent.dailyBudget)}</strong>
                    </div>

                    <div>
                      <span>Spent today</span>

                      <strong>{formatCurrency(agent.spentToday)}</strong>
                    </div>
                  </div>

                  <div className="budget-section">
                    <div className="budget-label">
                      <span>Budget consumed</span>
                      <span>{budgetPercentage}%</span>
                    </div>

                    <div className="progress-track">
                      <div
                        className="progress-value"
                        style={{
                          width: `${budgetPercentage}%`,
                        }}
                      />
                    </div>

                    <small>
                      {formatCurrency(agent.spentToday)} of{" "}
                      {formatCurrency(agent.dailyBudget)}
                    </small>
                  </div>

                  <div className="permissions">
                    <span>Permissions</span>

                    <div className="permission-list">
                      {agent.allowedActions.map((action) => (
                        <span className="permission-chip" key={action}>
                          {formatActionName(action)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="agent-controls">
                    {agent.status !== "ACTIVE" && (
                      <button
                        className="control-button activate-button"
                        type="button"
                        disabled={isControlLoading}
                        onClick={() => {
                          void changeAgentStatus(agent.id, "ACTIVE");
                        }}
                      >
                        Activate
                      </button>
                    )}

                    {agent.status === "ACTIVE" && (
                      <button
                        className="control-button pause-button"
                        type="button"
                        disabled={isControlLoading}
                        onClick={() => {
                          void changeAgentStatus(agent.id, "PAUSED");
                        }}
                      >
                        Pause
                      </button>
                    )}

                    {agent.status !== "REVOKED" && (
                      <button
                        className="control-button revoke-button"
                        type="button"
                        disabled={isControlLoading}
                        onClick={() => {
                          const confirmed = window.confirm(
                            `Revoke ${agent.name}? Its actions will be blocked immediately.`,
                          );

                          if (confirmed) {
                            void changeAgentStatus(agent.id, "REVOKED");
                          }
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section className="audit-section">
        <div className="section-heading">
          <div>
            <h2>Governance Audit Trail</h2>

            <p>
              Chronological evidence of policy decisions and operational control
              changes.
            </p>
          </div>

          <span className="audit-count">
            {auditEvents.length} recent events
          </span>
        </div>

        {auditEvents.length === 0 ? (
          <div className="message-card">
            No audit events have been recorded yet.
          </div>
        ) : (
          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Agent</th>
                  <th>Action</th>
                  <th>Outcome</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {auditEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="audit-time">
                      {formatDateTime(event.createdAt)}
                    </td>

                    <td>{formatAuditCategory(event.category)}</td>

                    <td>{event.agentName ?? "System"}</td>

                    <td>
                      {event.action ? formatActionName(event.action) : "—"}

                      {typeof event.amount === "number" && (
                        <span className="audit-amount">
                          {formatCurrency(event.amount)}
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={`audit-outcome audit-outcome-${event.outcome
                          .toLowerCase()
                          .replaceAll("_", "-")}`}
                      >
                        {event.outcome.replaceAll("_", " ")}
                      </span>
                    </td>

                    <td className="audit-message">{event.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
