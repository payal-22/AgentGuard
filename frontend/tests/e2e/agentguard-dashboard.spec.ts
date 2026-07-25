import { expect, test } from "@playwright/test";

const API_BASE_URL = "http://localhost:4100";

test.describe.serial("AgentGuard dashboard", () => {
  test.beforeEach(async ({ request }) => {
    await request.post(`${API_BASE_URL}/api/system/resume`);

    await request.patch(`${API_BASE_URL}/api/agents/refund-agent/status`, {
      data: {
        status: "ACTIVE",
      },
    });
  });

  test("loads agents and governance controls", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "AgentGuard",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", {
        name: "Managed Agents",
      }),
    ).toBeVisible();

    await expect(
      page.getByText("System operational", {
        exact: true,
      }),
    ).toBeVisible();

    const refundCard = page.locator("article.agent-card").filter({
      hasText: "Refund Agent",
    });

    await expect(refundCard).toBeVisible();

    await expect(refundCard).toContainText("ACTIVE");

    await expect(refundCard).toContainText("Issue Refund");
  });

  test("evaluates an allowed action through the UI", async ({ page }) => {
    await page.goto("/");

    await page.locator("#agent").selectOption("refund-agent");

    await page.locator("#action").selectOption("ISSUE_REFUND");

    await page.locator("#amount").fill("1000");

    await page.locator("#customerId").fill("UI-ALLOWED-2001");

    await page
      .getByRole("button", {
        name: "Evaluate Action",
      })
      .click();

    const decisionCard = page.locator(".decision-card");

    await expect(decisionCard).toBeVisible();

    await expect(decisionCard).toContainText("ALLOWED");

    await expect(decisionCard).toContainText("ALL_POLICIES_PASSED");

    await expect(decisionCard).toContainText("₹1,000");
  });

  test("opens and closes the policy editor", async ({ page }) => {
    await page.goto("/");

    const refundCard = page.locator("article.agent-card").filter({
      hasText: "Refund Agent",
    });

    await refundCard
      .getByRole("button", {
        name: "Edit Policy",
      })
      .click();

    const dialog = page.getByRole("dialog", {
      name: "Edit Refund Agent",
    });

    await expect(dialog).toBeVisible();

    await expect(dialog.getByLabel("Transaction limit")).toHaveValue("10000");

    await expect(dialog.getByLabel("Approval threshold")).toHaveValue("5000");

    await expect(dialog.getByLabel("Daily budget")).toHaveValue("50000");

    await dialog
      .getByRole("button", {
        name: "Cancel",
      })
      .click();

    await expect(dialog).toBeHidden();
  });

  test("creates and approves a human approval request", async ({
    page,
    request,
  }) => {
    const customerId = `UI-APPROVAL-${Date.now()}`;

    const createResponse = await request.post(
      `${API_BASE_URL}/api/actions/evaluate`,
      {
        data: {
          agentId: "refund-agent",

          action: "ISSUE_REFUND",

          amount: 7_000,
          customerId,
        },
      },
    );

    expect(createResponse.ok()).toBeTruthy();

    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Human Approval Queue",
      }),
    ).toBeVisible();

    const approvalCard = page.locator("article.approval-card").filter({
      hasText: customerId,
    });

    await expect(approvalCard).toBeVisible();

    await expect(approvalCard).toContainText("PENDING");

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });

    await approvalCard
      .getByRole("button", {
        name: "Approve & Execute",
      })
      .click();

    await expect(approvalCard).toContainText(
      "This action was approved and executed.",
    );

    await expect(approvalCard).toContainText("APPROVED");
  });

  test("activates and resumes the fleet emergency stop", async ({
    page,
    request,
  }) => {
    await page.goto("/");

    try {
      page.once("dialog", async (dialog) => {
        await dialog.accept();
      });

      await page
        .getByRole("button", {
          name: "Emergency Stop",
        })
        .click();

      await expect(
        page.getByText("Emergency stop active", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByRole("heading", {
          name: "All financial agents are stopped",
        }),
      ).toBeVisible();

      await page
        .getByRole("button", {
          name: "Resume All Agents",
        })
        .click();

      await expect(
        page.getByText("System operational", {
          exact: true,
        }),
      ).toBeVisible();
    } finally {
      await request.post(`${API_BASE_URL}/api/system/resume`);
    }
  });
});
