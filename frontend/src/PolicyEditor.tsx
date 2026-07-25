import { useState, type FormEvent } from "react";

import { updateAgentPolicy, type FinancialAgent } from "./services/api";

import "./PolicyEditor.css";

type PolicyEditorProps = {
  agent: FinancialAgent;
  onClose: () => void;
  onSaved: (agent: FinancialAgent) => void;
};

function normalizeActions(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((action) => action.trim().toUpperCase().replaceAll(" ", "_"))
        .filter(Boolean),
    ),
  ];
}

function PolicyEditor({ agent, onClose, onSaved }: PolicyEditorProps) {
  const [transactionLimit, setTransactionLimit] = useState(
    String(agent.transactionLimit),
  );
  const [approvalThreshold, setApprovalThreshold] = useState(
    String(agent.approvalThreshold),
  );
  const [dailyBudget, setDailyBudget] = useState(String(agent.dailyBudget));
  const [allowedActions, setAllowedActions] = useState(
    agent.allowedActions.join("\n"),
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const parsedTransactionLimit = Number(transactionLimit);
    const parsedApprovalThreshold = Number(approvalThreshold);
    const parsedDailyBudget = Number(dailyBudget);
    const normalizedActions = normalizeActions(allowedActions);

    if (
      !Number.isInteger(parsedTransactionLimit) ||
      parsedTransactionLimit <= 0
    ) {
      setError("Transaction limit must be a positive whole number.");
      return;
    }

    if (
      !Number.isInteger(parsedApprovalThreshold) ||
      parsedApprovalThreshold <= 0
    ) {
      setError("Approval threshold must be a positive whole number.");
      return;
    }

    if (!Number.isInteger(parsedDailyBudget) || parsedDailyBudget <= 0) {
      setError("Daily budget must be a positive whole number.");
      return;
    }

    if (parsedApprovalThreshold > parsedTransactionLimit) {
      setError("Approval threshold cannot exceed the transaction limit.");
      return;
    }

    if (parsedDailyBudget < agent.spentToday) {
      setError(
        `Daily budget cannot be lower than the current spend of ₹${agent.spentToday.toLocaleString(
          "en-IN",
        )}.`,
      );
      return;
    }

    if (normalizedActions.length === 0) {
      setError("Enter at least one allowed action.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");

      const result = await updateAgentPolicy(agent.id, {
        transactionLimit: parsedTransactionLimit,
        approvalThreshold: parsedApprovalThreshold,
        dailyBudget: parsedDailyBudget,
        allowedActions: normalizedActions,
      });

      onSaved(result.agent);
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The policy could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="policy-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="policy-editor-title"
        aria-modal="true"
        className="policy-modal"
        role="dialog"
      >
        <div className="policy-modal-header">
          <div>
            <span className="policy-modal-eyebrow">
              Governance configuration
            </span>

            <h2 id="policy-editor-title">Edit {agent.name}</h2>

            <p>
              Update spending controls and the actions this agent is permitted
              to perform.
            </p>
          </div>

          <button
            aria-label="Close policy editor"
            className="policy-close-button"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form className="policy-editor-form" onSubmit={handleSubmit}>
          <div className="policy-editor-grid">
            <label className="policy-field">
              <span>Transaction limit</span>
              <input
                min="1"
                onChange={(event) => {
                  setTransactionLimit(event.target.value);
                }}
                required
                step="1"
                type="number"
                value={transactionLimit}
              />
              <small>Maximum value for one automatic action.</small>
            </label>

            <label className="policy-field">
              <span>Approval threshold</span>
              <input
                min="1"
                onChange={(event) => {
                  setApprovalThreshold(event.target.value);
                }}
                required
                step="1"
                type="number"
                value={approvalThreshold}
              />
              <small>Higher amounts enter the human approval queue.</small>
            </label>

            <label className="policy-field">
              <span>Daily budget</span>
              <input
                min={Math.max(agent.spentToday, 1)}
                onChange={(event) => {
                  setDailyBudget(event.target.value);
                }}
                required
                step="1"
                type="number"
                value={dailyBudget}
              />
              <small>
                Current spend: ₹{agent.spentToday.toLocaleString("en-IN")}
              </small>
            </label>
          </div>

          <label className="policy-field">
            <span>Allowed actions</span>
            <textarea
              onChange={(event) => {
                setAllowedActions(event.target.value);
              }}
              required
              rows={6}
              value={allowedActions}
            />
            <small>
              Enter one action per line or separate actions with commas. Spaces
              are converted to underscores.
            </small>
          </label>

          {error && <div className="policy-editor-error">{error}</div>}

          <div className="policy-modal-actions">
            <button
              className="policy-cancel-button"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>

            <button
              className="policy-save-button"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Saving policy..." : "Save Policy"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default PolicyEditor;
