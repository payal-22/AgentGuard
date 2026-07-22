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
    evaluatedAt: string;
  };
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

function App() {
  const [agents, setAgents] = useState<FinancialAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedAgentId, setSelectedAgentId] =
    useState("refund-agent");

  const [selectedAction, setSelectedAction] =
    useState("ISSUE_REFUND");

  const [amount, setAmount] = useState("2000");
  const [customerId, setCustomerId] = useState("CM-1001");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");

  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResponse["data"] | null>(null);

  const selectedAgent = agents.find(
    (agent) => agent.id === selectedAgentId,
  );

  

  useEffect(() => {
  let isCancelled = false;

  fetchAgents()
    .then((agentData) => {
      if (!isCancelled) {
        setAgents(agentData);
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

      const response = await fetch(
        `${API_URL}/api/actions/evaluate`,
        {
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
        },
      );

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

      const updatedAgents = await fetchAgents();
      setAgents(updatedAgents);
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
            Monitor permissions, budgets and operational status for
            autonomous financial agents.
          </p>
        </div>

        <div className="system-status">
          <span className="status-dot" />
          System operational
        </div>
      </header>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Total Agents</span>
          <strong>{agents.length}</strong>
        </article>

        <article className="metric-card">
          <span>Active Agents</span>

          <strong>
            {
              agents.filter(
                (agent) => agent.status === "ACTIVE",
              ).length
            }
          </strong>
        </article>

        <article className="metric-card">
          <span>Total Spend Today</span>

          <strong>
            {formatCurrency(
              agents.reduce(
                (total, agent) => total + agent.spentToday,
                0,
              ),
            )}
          </strong>
        </article>
      </section>

      <section className="simulator-section">
        <div className="section-heading">
          <div>
            <h2>Agent Simulator</h2>

            <p>
              Submit a financial action and evaluate it against the
              active governance policies.
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
                    {formatCurrency(
                      selectedAgent.transactionLimit,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Approval above</span>

                  <strong>
                    {formatCurrency(
                      selectedAgent.approvalThreshold,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Remaining budget</span>

                  <strong>
                    {formatCurrency(
                      selectedAgent.dailyBudget -
                        selectedAgent.spentToday,
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
              {isSubmitting
                ? "Evaluating action..."
                : "Evaluate Action"}
            </button>
          </form>

          <div className="result-panel">
            {!evaluationResult && (
              <div className="empty-result">
                <span className="empty-result-icon">⚡</span>

                <h3>No action evaluated yet</h3>

                <p>
                  Select an agent, action and amount to see the policy
                  decision.
                </p>
              </div>
            )}

            {evaluationResult && (
              <article
                className={`decision-card decision-${evaluationResult.decision.status
                  .toLowerCase()
                  .replaceAll("_", "-")}`}
              >
                <span className="decision-label">
                  Policy decision
                </span>

                <h3>
                  {evaluationResult.decision.status.replaceAll(
                    "_",
                    " ",
                  )}
                </h3>

                <p>{evaluationResult.decision.reason}</p>

                <div className="decision-details">
                  <div>
                    <span>Agent</span>
                    <strong>{evaluationResult.agent.name}</strong>
                  </div>

                  <div>
                    <span>Action</span>
                    <strong>
                      {formatActionName(
                        evaluationResult.request.action,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Amount</span>
                    <strong>
                      {formatCurrency(
                        evaluationResult.request.amount,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Policy code</span>
                    <strong>
                      {evaluationResult.decision.policyCode}
                    </strong>
                  </div>

                  <div>
                    <span>Spend before</span>
                    <strong>
                      {formatCurrency(
                        evaluationResult.budget.spentBefore,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Spend after</span>
                    <strong>
                      {formatCurrency(
                        evaluationResult.budget.spentAfter,
                      )}
                    </strong>
                  </div>
                </div>
              </article>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <h2>Managed Agents</h2>

            <p>
              Current governance configuration for each financial
              agent.
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="message-card">Loading agents…</div>
        )}

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
                Math.round(
                  (agent.spentToday / agent.dailyBudget) * 100,
                ),
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

                      <strong>
                        {formatCurrency(agent.transactionLimit)}
                      </strong>
                    </div>

                    <div>
                      <span>Approval threshold</span>

                      <strong>
                        {formatCurrency(
                          agent.approvalThreshold,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Daily budget</span>

                      <strong>
                        {formatCurrency(agent.dailyBudget)}
                      </strong>
                    </div>

                    <div>
                      <span>Spent today</span>

                      <strong>
                        {formatCurrency(agent.spentToday)}
                      </strong>
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
                        <span
                          className="permission-chip"
                          key={action}
                        >
                          {formatActionName(action)}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;