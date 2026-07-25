import { expect, test } from "@playwright/test";

const API_BASE_URL = "http://localhost:4100";

type AgentStatus = "ACTIVE" | "PAUSED" | "REVOKED";

type FinancialAgent = {
  id: string;
  name: string;
  status: AgentStatus;
  allowedActions: string[];
  transactionLimit: number;
  approvalThreshold: number;
  dailyBudget: number;
  spentToday: number;
};

type AgentListResponse = {
  success: boolean;
  data: FinancialAgent[];
};

type EvaluationResponse = {
  success: boolean;

  data: {
    decision: {
      status: "ALLOWED" | "DENIED" | "APPROVAL_REQUIRED";

      policyCode: string;
      reason: string;
    };

    budget: {
      dailyBudget: number;
      spentBefore: number;
      spentAfter: number;
      remainingBudget: number;
    };
  };
};

test.describe.serial("AgentGuard API", () => {
  test("returns backend and database health", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);

    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as {
      success: boolean;
      message: string;
      database: string;
    };

    expect(body).toMatchObject({
      success: true,
      database: "connected",
    });
  });

  test("returns the seeded financial agents", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/agents`);

    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as AgentListResponse;

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);

    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "refund-agent",
          name: "Refund Agent",
          status: "ACTIVE",

          allowedActions: expect.arrayContaining([
            "VIEW_TRANSACTION",
            "ISSUE_REFUND",
          ]),
        }),

        expect.objectContaining({
          id: "travel-agent",
          name: "Travel Booking Agent",
        }),

        expect.objectContaining({
          id: "servicing-agent",
          name: "Card Servicing Agent",
          status: "PAUSED",
        }),
      ]),
    );
  });

  test("evaluates allowed, approval-required and denied actions", async ({
    request,
  }) => {
    const cases = [
      {
        name: "allowed action",
        amount: 1_000,
        customerId: "API-ALLOWED-1001",
        expectedStatus: "ALLOWED",
        expectedPolicyCode: "ALL_POLICIES_PASSED",
      },

      {
        name: "approval-required action",
        amount: 7_000,
        customerId: "API-APPROVAL-1002",

        expectedStatus: "APPROVAL_REQUIRED",

        expectedPolicyCode: "SUPERVISOR_APPROVAL_REQUIRED",
      },

      {
        name: "denied action",
        amount: 20_000,
        customerId: "API-DENIED-1003",
        expectedStatus: "DENIED",

        expectedPolicyCode: "TRANSACTION_LIMIT_EXCEEDED",
      },
    ] as const;

    for (const testCase of cases) {
      const response = await request.post(
        `${API_BASE_URL}/api/actions/evaluate`,
        {
          data: {
            agentId: "refund-agent",
            action: "ISSUE_REFUND",
            amount: testCase.amount,

            customerId: testCase.customerId,
          },
        },
      );

      expect(
        response.ok(),
        `${testCase.name} should return HTTP success`,
      ).toBeTruthy();

      const body = (await response.json()) as EvaluationResponse;

      expect(body.success).toBe(true);

      expect(body.data.decision.status).toBe(testCase.expectedStatus);

      expect(body.data.decision.policyCode).toBe(testCase.expectedPolicyCode);
    }
  });

  test("blocks actions when an agent is paused", async ({ request }) => {
    const pauseResponse = await request.patch(
      `${API_BASE_URL}/api/agents/refund-agent/status`,
      {
        data: {
          status: "PAUSED",
        },
      },
    );

    expect(pauseResponse.ok()).toBeTruthy();

    try {
      const evaluationResponse = await request.post(
        `${API_BASE_URL}/api/actions/evaluate`,
        {
          data: {
            agentId: "refund-agent",

            action: "ISSUE_REFUND",

            amount: 500,

            customerId: "API-PAUSED-1004",
          },
        },
      );

      expect(evaluationResponse.ok()).toBeTruthy();

      const body = (await evaluationResponse.json()) as EvaluationResponse;

      expect(body.data.decision.status).toBe("DENIED");

      expect(body.data.decision.policyCode).toBe("AGENT_PAUSED");
    } finally {
      await request.patch(`${API_BASE_URL}/api/agents/refund-agent/status`, {
        data: {
          status: "ACTIVE",
        },
      });
    }
  });

  test("blocks all actions during emergency stop", async ({ request }) => {
    const stopResponse = await request.post(
      `${API_BASE_URL}/api/system/emergency-stop`,
    );

    expect(stopResponse.ok()).toBeTruthy();

    try {
      const evaluationResponse = await request.post(
        `${API_BASE_URL}/api/actions/evaluate`,
        {
          data: {
            agentId: "refund-agent",

            action: "ISSUE_REFUND",

            amount: 500,

            customerId: "API-STOP-1005",
          },
        },
      );

      expect(evaluationResponse.ok()).toBeTruthy();

      const body = (await evaluationResponse.json()) as EvaluationResponse;

      expect(body.data.decision.status).toBe("DENIED");

      expect(body.data.decision.policyCode).toBe("EMERGENCY_STOP_ACTIVE");
    } finally {
      await request.post(`${API_BASE_URL}/api/system/resume`);
    }
  });
});
