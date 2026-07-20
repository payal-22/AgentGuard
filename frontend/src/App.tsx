import { useEffect, useState } from "react";
import "./App.css";

type AgentStatus = "ACTIVE" | "PAUSED" | "REVOKED";

type FinancialAgent = {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  allowedActions: string[];
  transactionLimit: number;
  dailyBudget: number;
  spentToday: number;
};

type AgentsResponse = {
  success: boolean;
  data: FinancialAgent[];
};

const API_URL = import.meta.env.VITE_API_URL as string;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function App() {
  const [agents, setAgents] = useState<FinancialAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadAgents(): Promise<void> {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(`${API_URL}/api/agents`);

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const result = (await response.json()) as AgentsResponse;

        if (!result.success) {
          throw new Error("The API could not return agents.");
        }

        setAgents(result.data);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.";

        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadAgents();
  }, []);

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
            {agents.filter((agent) => agent.status === "ACTIVE").length}
          </strong>
        </article>

        <article className="metric-card">
          <span>Paused Agents</span>
          <strong>
            {agents.filter((agent) => agent.status === "PAUSED").length}
          </strong>
        </article>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <h2>Managed Agents</h2>
            <p>Current governance configuration for each financial agent.</p>
          </div>
        </div>

        {isLoading && <div className="message-card">Loading agents…</div>}

        {errorMessage && (
          <div className="message-card error-card">
            <strong>Unable to load agents</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        {!isLoading && !errorMessage && (
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
                      <strong>
                        {formatCurrency(agent.transactionLimit)}
                      </strong>
                    </div>

                    <div>
                      <span>Daily budget</span>
                      <strong>{formatCurrency(agent.dailyBudget)}</strong>
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
                        style={{ width: `${budgetPercentage}%` }}
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
                          {action.replaceAll("_", " ")}
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