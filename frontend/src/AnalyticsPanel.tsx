import type { AnalyticsSummary } from "./services/api";

import "./AnalyticsPanel.css";

type AnalyticsPanelProps = {
  summary: AnalyticsSummary | null;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function AnalyticsPanel({ summary }: AnalyticsPanelProps) {
  if (!summary) {
    return (
      <section className="analytics-section">
        <div className="section-heading">
          <div>
            <h2>Governance Analytics</h2>
            <p>Loading policy decision analytics…</p>
          </div>
        </div>
      </section>
    );
  }

  const hasEvaluations = summary.totals.evaluations > 0;

  return (
    <section className="analytics-section">
      <div className="section-heading">
        <div>
          <h2>Governance Analytics</h2>
          <p>
            Live insight into allowed, denied and human-reviewed financial
            actions.
          </p>
        </div>

        <span className="analytics-total">
          {summary.totals.evaluations} evaluations
        </span>
      </div>

      <div className="analytics-summary-grid">
        <article className="analytics-card analytics-card-allowed">
          <span>Allowed</span>
          <strong>{summary.totals.allowed}</strong>
          <small>{formatPercentage(summary.rates.allowed)} of decisions</small>
        </article>

        <article className="analytics-card analytics-card-denied">
          <span>Denied</span>
          <strong>{summary.totals.denied}</strong>
          <small>{formatPercentage(summary.rates.denied)} of decisions</small>
        </article>

        <article className="analytics-card analytics-card-approval">
          <span>Approval Required</span>
          <strong>{summary.totals.approvalRequired}</strong>
          <small>
            {formatPercentage(summary.rates.approvalRequired)} of decisions
          </small>
        </article>

        <article className="analytics-card">
          <span>Evaluated Value</span>
          <strong>{formatCurrency(summary.totals.evaluatedAmount)}</strong>
          <small>Across all policy evaluations</small>
        </article>
      </div>

      <div className="decision-distribution">
        <div className="decision-distribution-header">
          <h3>Decision distribution</h3>
          <span>
            {hasEvaluations
              ? `${summary.totals.evaluations} total`
              : "No evaluations yet"}
          </span>
        </div>

        <div
          aria-label="Policy decision distribution"
          className="decision-distribution-track"
          role="img"
        >
          <div
            className="decision-distribution-segment distribution-allowed"
            style={{ width: `${summary.rates.allowed}%` }}
            title={`Allowed: ${summary.totals.allowed}`}
          />
          <div
            className="decision-distribution-segment distribution-denied"
            style={{ width: `${summary.rates.denied}%` }}
            title={`Denied: ${summary.totals.denied}`}
          />
          <div
            className="decision-distribution-segment distribution-approval"
            style={{ width: `${summary.rates.approvalRequired}%` }}
            title={`Approval required: ${summary.totals.approvalRequired}`}
          />
        </div>

        <div className="analytics-legend">
          <span>
            <i className="legend-allowed" />
            Allowed
          </span>
          <span>
            <i className="legend-denied" />
            Denied
          </span>
          <span>
            <i className="legend-approval" />
            Approval required
          </span>
        </div>
      </div>

      <div className="analytics-lower-grid">
        <div className="agent-analytics-card">
          <div className="analytics-subheading">
            <h3>Agent performance</h3>
            <span>{summary.byAgent.length} agents</span>
          </div>

          {summary.byAgent.length === 0 ? (
            <p className="analytics-empty">
              Agent analytics will appear after actions are evaluated.
            </p>
          ) : (
            <div className="agent-analytics-list">
              {summary.byAgent.map((agent) => (
                <article className="agent-analytics-row" key={agent.agentId}>
                  <div>
                    <strong>{agent.agentName}</strong>
                    <span>
                      {agent.evaluations} evaluations ·{" "}
                      {formatCurrency(agent.evaluatedAmount)}
                    </span>
                  </div>

                  <div className="agent-decision-counts">
                    <span className="agent-count-allowed">
                      {agent.allowed} allowed
                    </span>
                    <span className="agent-count-denied">
                      {agent.denied} denied
                    </span>
                    <span className="agent-count-approval">
                      {agent.approvalRequired} review
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="approval-analytics-card">
          <div className="analytics-subheading">
            <h3>Approval outcomes</h3>
            <span>
              {summary.approvals.pending +
                summary.approvals.approved +
                summary.approvals.rejected}{" "}
              requests
            </span>
          </div>

          <dl className="approval-analytics-list">
            <div>
              <dt>Pending</dt>
              <dd>{summary.approvals.pending}</dd>
            </div>
            <div>
              <dt>Approved</dt>
              <dd>{summary.approvals.approved}</dd>
            </div>
            <div>
              <dt>Rejected</dt>
              <dd>{summary.approvals.rejected}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export default AnalyticsPanel;
