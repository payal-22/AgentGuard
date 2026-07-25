# AgentGuard

AgentGuard is a governance and safety platform for autonomous financial agents.

It evaluates agent actions against configurable policies, enforces transaction and budget limits, routes sensitive actions for human approval, provides emergency controls, and maintains a complete audit trail.

Built for the **American Express CodeStreet Hackathon**.

---

## Live Demo

- **Frontend:** [https://agent-guard-nine.vercel.app](https://agent-guard-nine.vercel.app)
- **Backend API:** [https://agentguard-production-f264.up.railway.app](https://agentguard-production-f264.up.railway.app)
- **Health Check:** [https://agentguard-production-f264.up.railway.app/health](https://agentguard-production-f264.up.railway.app/health)
- **Agents API:** [https://agentguard-production-f264.up.railway.app/api/agents](https://agentguard-production-f264.up.railway.app/api/agents)

---

## Problem Statement

Autonomous financial agents can perform tasks such as issuing refunds, booking travel, and servicing cards. However, these agents need strong governance controls to prevent:

- Unauthorized financial actions
- Excessive transaction amounts
- Daily budget overruns
- High-risk operations without human approval
- Activity from paused or revoked agents
- Uncontrolled actions during an emergency
- Missing accountability and audit history

AgentGuard acts as a governance layer between autonomous agents and financial operations.

---

## Solution

Before an autonomous financial agent executes an action, AgentGuard evaluates the request against predefined policies.

Each action receives one of three decisions:

- `ALLOWED`
- `DENIED`
- `APPROVAL_REQUIRED`

AgentGuard also provides an operator dashboard for managing agents, editing policies, reviewing sensitive requests, monitoring analytics, and stopping the complete system during an emergency.

---

## Main Features

### Agent Management

Each financial agent has:

- A status: `ACTIVE`, `PAUSED`, or `REVOKED`
- A list of permitted actions
- A maximum transaction limit
- A human approval threshold
- A daily spending budget
- Current daily spending

Operators can pause, activate, or revoke individual agents.

### Policy Evaluation

Every requested action is checked against:

1. Global emergency-stop status
2. Agent status
3. Agent permissions
4. Transaction limit
5. Remaining daily budget
6. Human approval threshold

### Human Approval Queue

Actions above an agent's approval threshold are sent to the human approval queue.

Reviewers can:

- Approve and execute an action
- Reject an action
- Review the requesting agent
- Review the customer ID
- Review the requested amount
- Review the policy decision and reason

### Emergency Controls

Operators can:

- Pause an individual agent
- Reactivate an individual agent
- Revoke an agent
- Stop all financial agents
- Resume the complete system

### Policy Editor

Agent policies can be updated directly from the dashboard.

Editable policy fields include:

- Transaction limit
- Approval threshold
- Daily budget
- Allowed actions

### Audit Trail

AgentGuard records important governance events, including:

- Action evaluations
- Agent status changes
- Approval decisions
- Policy updates
- Emergency-stop events
- System resume events

### Governance Analytics

The analytics dashboard displays:

- Allowed actions
- Denied actions
- Approval-required actions
- Total evaluated transaction value
- Decision distribution
- Agent-level performance
- Approval outcomes

---

## Example Agents

AgentGuard includes example financial agents such as:

### Refund Agent

Responsible for reviewing transactions and issuing eligible refunds.

Example permissions:

- `VIEW_TRANSACTION`
- `ISSUE_REFUND`

### Travel Booking Agent

Responsible for financial actions related to travel bookings.

### Card Servicing Agent

Responsible for card-related servicing operations.

Each agent has its own policies, permissions, transaction limits, approval thresholds, and daily budget.

---

## Policy Decision Examples

| Situation | Decision |
|---|---|
| Agent is active and all policies pass | `ALLOWED` |
| Amount exceeds the approval threshold | `APPROVAL_REQUIRED` |
| Amount exceeds the transaction limit | `DENIED` |
| Agent is paused | `DENIED` |
| Agent is revoked | `DENIED` |
| Agent does not have permission | `DENIED` |
| Daily budget would be exceeded | `DENIED` |
| Emergency stop is active | `DENIED` |

---

## Architecture

```text
User
  |
  v
React + Vite Dashboard
  |
  v
Express REST API
  |
  v
Policy Evaluation Engine
  |
  +---- Human Approval Queue
  |
  +---- Audit Event Service
  |
  +---- Governance Analytics
  |
  v
Prisma ORM
  |
  v
SQLite Database
```

### Production Architecture

```text
Browser
  |
  v
Vercel
React + Vite Frontend
  |
  | HTTPS API requests
  v
Railway
Express + Prisma Backend
  |
  v
Railway Persistent Volume
SQLite Database
```

### Production Request Flow

```text
https://agent-guard-nine.vercel.app
                |
                v
https://agentguard-production-f264.up.railway.app
                |
                v
        Prisma + SQLite
```

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- CSS
- Playwright

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- SQLite
- `@prisma/adapter-better-sqlite3`

### Testing

- Playwright API testing
- Playwright browser testing
- Chromium
- Automated end-to-end tests

### Deployment

- Vercel for the frontend
- Railway for the backend
- Railway persistent volume for SQLite
- GitHub Actions for continuous integration

---

## Project Structure

```text
agentguard/
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   │
│   ├── src/
│   │   └── server.ts
│   │
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── AnalyticsPanel.tsx
│   │   ├── AnalyticsPanel.css
│   │   ├── App.tsx
│   │   ├── PolicyEditor.tsx
│   │   ├── PolicyEditor.css
│   │   └── main.tsx
│   │
│   ├── tests/
│   │   ├── api/
│   │   └── e2e/
│   │
│   ├── playwright.config.ts
│   ├── package.json
│   └── vite.config.ts
│
├── .gitignore
└── README.md
```

---

## Prerequisites

Install the following before running AgentGuard locally:

- Node.js
- npm
- Git

Check the installed versions:

```bash
node --version
npm --version
git --version
```

---

## Local Development

The frontend and backend run as separate applications.

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4000
```

---

## Backend Setup

Open a terminal and move into the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create the backend environment file:

```bash
cp .env.example .env
```

Add the following values to `backend/.env`:

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=file:./prisma/dev.db
```

Generate the Prisma client:

```bash
npx prisma generate
```

Validate the Prisma schema:

```bash
npx prisma validate
```

Apply the existing database migrations:

```bash
npx prisma migrate deploy
```

Seed the database:

```bash
npx prisma db seed
```

Start the backend development server:

```bash
npm run dev
```

The backend will run at:

```text
http://localhost:4000
```

Test the health endpoint:

```bash
curl http://localhost:4000/health
```

Test the agents endpoint:

```bash
curl http://localhost:4000/api/agents
```

---

## Frontend Setup

Open another terminal and move into the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create a file named:

```text
frontend/.env
```

Add:

```env
VITE_API_BASE_URL=http://localhost:4000
```

Start the frontend development server:

```bash
npm run dev
```

Open the dashboard:

```text
http://localhost:5173
```

---

## Environment Variables

### Backend Environment Variables

| Variable | Local value | Production value |
|---|---|---|
| `PORT` | `4000` | Provided automatically by Railway |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | `https://agent-guard-nine.vercel.app` |
| `DATABASE_URL` | `file:./prisma/dev.db` | `file:/data/agentguard.db` |

Example local backend environment:

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=file:./prisma/dev.db
```

Production Railway environment:

```env
FRONTEND_ORIGIN=https://agent-guard-nine.vercel.app
DATABASE_URL=file:/data/agentguard.db
```

Do not manually set `PORT` on Railway. Railway provides it automatically.

### Frontend Environment Variables

| Variable | Local value | Production value |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:4000` | `https://agentguard-production-f264.up.railway.app` |

Example local frontend environment:

```env
VITE_API_BASE_URL=http://localhost:4000
```

Production Vercel environment:

```env
VITE_API_BASE_URL=https://agentguard-production-f264.up.railway.app
```

Never commit real `.env` files.

---

## API Endpoints

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Check backend and database health |

### Agents

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/agents` | Get all financial agents |
| `PATCH` | `/api/agents/:agentId/status` | Update an agent's status |
| `PATCH` | `/api/agents/:agentId/policy` | Update an agent's policy |

### System Controls

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/status` | Get emergency-stop status |
| `POST` | `/api/system/emergency-stop` | Stop all agents |
| `POST` | `/api/system/resume` | Resume the system |

### Action Evaluation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/actions/evaluate` | Evaluate an agent action |

### Human Approvals

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/approvals` | Get approval requests |
| `PATCH` | `/api/approvals/:approvalId` | Approve or reject a request |

### Audit and Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/audit-events` | Get audit history |
| `GET` | `/api/analytics/summary` | Get governance analytics |

---

## Example Action Evaluation

### Request

```bash
curl -X POST \
  https://agentguard-production-f264.up.railway.app/api/actions/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "refund-agent",
    "action": "ISSUE_REFUND",
    "amount": 1000,
    "customerId": "CUSTOMER-1001"
  }'
```

### Possible Response

```json
{
  "success": true,
  "data": {
    "decision": {
      "status": "ALLOWED",
      "policyCode": "ALL_POLICIES_PASSED",
      "reason": "The requested action passed all governance policies."
    }
  }
}
```

---

## Example Approval-Required Action

```bash
curl -X POST \
  https://agentguard-production-f264.up.railway.app/api/actions/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "refund-agent",
    "action": "ISSUE_REFUND",
    "amount": 7000,
    "customerId": "CUSTOMER-APPROVAL-1002"
  }'
```

A transaction above the agent's approval threshold can produce:

```json
{
  "status": "APPROVAL_REQUIRED",
  "policyCode": "SUPERVISOR_APPROVAL_REQUIRED"
}
```

The request will then appear in the Human Approval Queue.

---

## Example Denied Action

```bash
curl -X POST \
  https://agentguard-production-f264.up.railway.app/api/actions/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "refund-agent",
    "action": "ISSUE_REFUND",
    "amount": 20000,
    "customerId": "CUSTOMER-DENIED-1003"
  }'
```

A transaction above the transaction limit can produce:

```json
{
  "status": "DENIED",
  "policyCode": "TRANSACTION_LIMIT_EXCEEDED"
}
```

---

## Useful Backend Commands

Move into the backend directory:

```bash
cd backend
```

Start the development server:

```bash
npm run dev
```

Check TypeScript:

```bash
npm run check
```

Start the normal server:

```bash
npm start
```

Start the production server:

```bash
npm run start:production
```

Generate the Prisma client:

```bash
npx prisma generate
```

Validate the Prisma schema:

```bash
npx prisma validate
```

Apply migrations:

```bash
npx prisma migrate deploy
```

Seed the database:

```bash
npx prisma db seed
```

Open Prisma Studio:

```bash
npx prisma studio
```

---

## Useful Frontend Commands

Move into the frontend directory:

```bash
cd frontend
```

Start the development server:

```bash
npm run dev
```

Run ESLint:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

## Automated Testing

AgentGuard uses Playwright for API and browser testing.

### API Tests

```bash
cd frontend
npm run test:api
```

### Browser Tests

```bash
npm run test:browser
```

### Complete Test Suite

```bash
npm run test:e2e
```

### Headed Browser Mode

```bash
npm run test:e2e:headed
```

### Debug Mode

```bash
npm run test:e2e:debug
```

### Playwright UI

```bash
npm run test:e2e:ui
```

### Open Test Report

```bash
npm run test:e2e:report
```

The automated tests cover:

- Backend and database health
- Seeded financial agents
- Allowed actions
- Denied actions
- Approval-required actions
- Paused-agent enforcement
- Emergency-stop enforcement
- Dashboard loading
- Agent governance controls
- Policy editor
- Human approval workflow
- Fleet emergency controls

Playwright uses isolated frontend and backend servers with a separate test database.

---

## Continuous Integration

GitHub Actions runs automated validation for pushes and pull requests to `main`.

The CI pipeline:

1. Checks out the repository
2. Installs backend dependencies
3. Generates the Prisma client
4. Validates the Prisma schema
5. Checks backend TypeScript
6. Installs frontend dependencies
7. Runs frontend linting
8. Builds the frontend
9. Installs Chromium
10. Runs Playwright API and browser tests
11. Uploads Playwright reports and failure artifacts

Workflow file:

```text
.github/workflows/ci.yml
```

---

## Backend Deployment on Railway

The backend is deployed at:

[https://agentguard-production-f264.up.railway.app](https://agentguard-production-f264.up.railway.app)

### Railway Settings

```text
Root Directory: /backend
Build Command: npm ci --include=dev && npx prisma generate && npm run check
Start Command: npm run start:production
Health Check Path: /health
Volume Mount Path: /data
```

### Railway Environment Variables

```env
DATABASE_URL=file:/data/agentguard.db
FRONTEND_ORIGIN=https://agent-guard-nine.vercel.app
```

Railway provides the `PORT` variable automatically.

### Railway Persistent Storage

The SQLite database is stored at:

```text
/data/agentguard.db
```

The `/data` directory is backed by a Railway persistent volume so application data remains available after redeployments and service restarts.

### Verify the Railway Deployment

```bash
curl https://agentguard-production-f264.up.railway.app/health
```

```bash
curl https://agentguard-production-f264.up.railway.app/api/agents
```

---

## Frontend Deployment on Vercel

The frontend is deployed at:

[https://agent-guard-nine.vercel.app](https://agent-guard-nine.vercel.app)

### Vercel Settings

```text
Root Directory: frontend
Framework Preset: Vite
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

### Vercel Environment Variable

```env
VITE_API_BASE_URL=https://agentguard-production-f264.up.railway.app
```

The Vite frontend reads this variable during the production build and uses it as the backend API base URL.

---

## Deployment Verification

After deploying both applications, verify the following:

1. Open [https://agent-guard-nine.vercel.app](https://agent-guard-nine.vercel.app).
2. Confirm that the financial agents load.
3. Confirm that the system shows as operational.
4. Evaluate an allowed action.
5. Evaluate an action that requires approval.
6. Evaluate a denied action.
7. Pause and reactivate an agent.
8. Open and update an agent policy.
9. Approve or reject an approval request.
10. Activate and resume the emergency stop.
11. Confirm that analytics update.
12. Confirm that audit events appear.

---

## Troubleshooting

### Railway Cannot Detect the Application

Set the Railway service root directory to:

```text
/backend
```

Railway must analyze:

```text
backend/package.json
```

It should not analyze the complete repository root.

### Frontend Shows `Failed to fetch`

Check that:

- Railway is online
- The Railway health endpoint works
- The Vercel environment variable is correct
- Vercel was redeployed after changing environment variables
- Railway `FRONTEND_ORIGIN` exactly matches the Vercel URL

Correct Vercel environment variable:

```env
VITE_API_BASE_URL=https://agentguard-production-f264.up.railway.app
```

Correct Railway environment variable:

```env
FRONTEND_ORIGIN=https://agent-guard-nine.vercel.app
```

### Browser Shows a CORS Error

Make sure Railway contains:

```env
FRONTEND_ORIGIN=https://agent-guard-nine.vercel.app
```

Do not include a trailing slash.

After changing the variable, deploy the pending Railway changes.

### SQLite Data Disappears

Confirm that:

- A Railway volume is attached
- The volume mount path is `/data`
- `DATABASE_URL` points to the volume

Correct value:

```env
DATABASE_URL=file:/data/agentguard.db
```

### Prisma Migration Fails

Run locally:

```bash
cd backend
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

Confirm that all files inside the following directory are committed:

```text
backend/prisma/migrations/
```

### Vercel Uses the Wrong Backend

Check the Vercel production environment variable:

```env
VITE_API_BASE_URL=https://agentguard-production-f264.up.railway.app
```

After updating the value, redeploy the Vercel project because Vite environment variables are included during the build.

---

## Security Considerations

AgentGuard is currently a hackathon prototype.

Before production use, it would require:

- User authentication
- Role-based access control
- Multi-factor authentication
- Secure session management
- Request validation
- API rate limiting
- Encryption for sensitive data
- Database backups
- Monitoring and alerting
- Signed or tamper-resistant audit events
- Approval authorization controls
- Security testing
- Financial compliance reviews
- Disaster recovery procedures

---

## Future Improvements

- Authentication and role-based access control
- Multi-user approval workflows
- Multi-factor approval
- PostgreSQL support
- Configurable policy templates
- Policy versioning
- Policy rollback
- Real-time notifications
- Signed audit events
- Compliance report exports
- Scheduled daily budget resets
- Advanced risk scoring
- Agent-specific monitoring alerts
- Integration with real payment systems
- Integration with card servicing platforms
- Automated anomaly detection

---

## Disclaimer

AgentGuard is a demonstration project created for a hackathon.

It is not production financial infrastructure and should not be used to process real financial transactions without additional security, compliance, reliability, monitoring, and operational controls.
