import cors from "cors";
import express, { type Request, type Response } from "express";

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

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json());

const agents: FinancialAgent[] = [
  {
    id: "refund-agent",
    name: "Refund Agent",
    description: "Processes eligible customer refund requests.",
    status: "ACTIVE",
    allowedActions: ["VIEW_TRANSACTION", "ISSUE_REFUND"],
    transactionLimit: 10000,
    dailyBudget: 50000,
    spentToday: 12000,
  },
  {
    id: "travel-agent",
    name: "Travel Booking Agent",
    description: "Books flights and hotels within approved limits.",
    status: "ACTIVE",
    allowedActions: ["BOOK_FLIGHT", "BOOK_HOTEL"],
    transactionLimit: 25000,
    dailyBudget: 100000,
    spentToday: 30000,
  },
  {
    id: "servicing-agent",
    name: "Card Servicing Agent",
    description: "Handles fee waivers and card servicing requests.",
    status: "PAUSED",
    allowedActions: ["WAIVE_FEE", "REPLACE_CARD"],
    transactionLimit: 5000,
    dailyBudget: 20000,
    spentToday: 4000,
  },
];

app.get("/health", (_request: Request, response: Response) => {
  response.status(200).json({
    success: true,
    message: "AgentGuard backend is running",
  });
});

app.get("/api/agents", (_request: Request, response: Response) => {
  response.status(200).json({
    success: true,
    data: agents,
  });
});

app.use((_request: Request, response: Response) => {
  response.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.listen(port, () => {
  console.log(`AgentGuard backend running at http://localhost:${port}`);
});