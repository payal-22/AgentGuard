import { prisma } from "../src/lib/prisma";

const agents = [
  {
    id: "refund-agent",
    name: "Refund Agent",
    description:
      "Processes eligible customer refund requests.",
    status: "ACTIVE" as const,
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
    status: "ACTIVE" as const,
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
    status: "PAUSED" as const,
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

async function seedAgents(): Promise<void> {
  for (const agent of agents) {
    await prisma.financialAgent.upsert({
      where: {
        id: agent.id,
      },

      update: {
        name: agent.name,
        description: agent.description,
        status: agent.status,
        transactionLimit: agent.transactionLimit,
        approvalThreshold: agent.approvalThreshold,
        dailyBudget: agent.dailyBudget,
        spentToday: agent.spentToday,

        allowedActions: {
          deleteMany: {},

          create: agent.allowedActions.map((action) => ({
            action,
          })),
        },
      },

      create: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.status,
        transactionLimit: agent.transactionLimit,
        approvalThreshold: agent.approvalThreshold,
        dailyBudget: agent.dailyBudget,
        spentToday: agent.spentToday,

        allowedActions: {
          create: agent.allowedActions.map((action) => ({
            action,
          })),
        },
      },
    });
  }
}

async function seedSystemState(): Promise<void> {
  const existingSystemState =
    await prisma.systemState.findUnique({
      where: {
        id: 1,
      },
    });

  if (!existingSystemState) {
    await prisma.systemState.create({
      data: {
        id: 1,
        emergencyStop: false,
      },
    });
  }
}

async function main(): Promise<void> {
  console.log("Starting AgentGuard database seed...");

  await seedAgents();
  await seedSystemState();

  const agentCount =
    await prisma.financialAgent.count();

  console.log(
    `Seed completed successfully. ${agentCount} agents are available.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });