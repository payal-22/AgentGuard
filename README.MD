AgentGuard
AgentGuard is a governance and safety layer for autonomous financial agents. It evaluates agent actions against configurable policies, enforces transaction and budget limits, routes sensitive actions for human approval, and keeps a complete audit trail.
The project was built for the American Express CodeStreet hackathon.
Overview
Autonomous financial agents can execute useful tasks quickly, but they also need clear boundaries. AgentGuard provides those boundaries through:
Fine-grained agent permissions
Per-transaction limits
Human approval thresholds
Daily spending budgets
Agent pause, activation, and revocation controls
Fleet-wide emergency stop
Action evaluation before execution
Human approval and rejection workflows
Policy editing
Governance analytics
Persistent audit history
Architecture
flowchart LR
    U[Operator] --> F[React Dashboard]
    F -->|HTTPS API requests| B[Express API]
    B --> P[Policy Evaluator]
    P --> D[(SQLite Database)]
    P --> A[Approval Queue]
    P --> L[Audit Log]
Operator

React Dashboard

Express API

Policy Evaluator

SQLite Database

Approval Queue

Audit Log

HTTPS API requests

​
Production deployment
Browser
  |
  v
Vercel - React and Vite frontend
  |
  v
Railway - Express and Prisma backend
  |
  v
Railway persistent volume - SQLite database
​
Main Features
Agent management
Each financial agent has:
A current status: ACTIVE, PAUSED, or REVOKED
A list of permitted actions
A transaction limit
A human approval threshold
A daily spending budget
Current daily spending
Policy evaluation
Before an agent executes an action, AgentGuard evaluates:
Whether the system emergency stop is active
Whether the agent is active
Whether the requested action is permitted
Whether the amount exceeds the transaction limit
Whether the amount exceeds the remaining daily budget
Whether the amount requires human approval
An evaluated action can result in:
ALLOWED
DENIED
APPROVAL_REQUIRED
Human approval queue
Actions above an agent's approval threshold can be reviewed by an operator.
The operator can:
Approve and execute the action
Reject the action
Review the reason, amount, customer, and policy decision
Emergency controls
AgentGuard supports:
Pausing an individual agent
Reactivating an individual agent
Revoking an individual agent
Stopping all financial agents
Resuming the complete system
Audit and analytics
The dashboard includes:
Policy decision history
Agent status changes
Approval activity
Policy updates
Emergency stop events
Allowed, denied, and approval-required totals
Agent-level performance
Approval outcomes
Evaluated transaction value
Technology Stack
Frontend
React
TypeScript
Vite
CSS
Playwright
Backend
Node.js
Express
TypeScript
Prisma ORM
SQLite
@prisma/adapter-better-sqlite3
Deployment
Vercel for the frontend
Railway for the backend
Railway persistent volume for SQLite
GitHub Actions for continuous integration
Project Structure
agentguard/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   └── server.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── AnalyticsPanel.tsx
│   │   ├── App.tsx
│   │   ├── PolicyEditor.tsx
│   │   └── main.tsx
│   ├── tests/
│   │   ├── api/
│   │   └── e2e/
│   ├── playwright.config.ts
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
​
Prerequisites
Install the following before running the project:
Node.js 24
npm
Git
Check your installation:
node --version
npm --version
git --version
​
Local Setup
Clone the repository:
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd agentguard
​
Backend Setup
Open a terminal and run:
cd backend
npm install
​
Create the backend environment file:
cp .env.example .env
​
Use the following local values in backend/.env:
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=file:./prisma/dev.db
​
Generate the Prisma client:
npx prisma generate
​
Apply database migrations:
npx prisma migrate deploy
​
Seed the database:
npx prisma db seed
​
Start the backend:
npm run dev
​
The backend should be available at:
<http://localhost:4000>
​
Verify it:
curl <http://localhost:4000/health>
​
Frontend Setup
Open another terminal:
cd frontend
npm install
​
Create frontend/.env:
VITE_API_BASE_URL=http://localhost:4000
​
Start the frontend:
npm run dev
​
Open:
<http://localhost:5173>
​
Useful Commands
Backend
cd backend

npm run dev
npm run check
npm start
npm run start:production
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npx prisma studio
​
Frontend
cd frontend

npm run dev
npm run lint
npm run build
npm run preview
​
Playwright tests
cd frontend

npm run test:api
npm run test:browser
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:debug
npm run test:e2e:ui
npm run test:e2e:report
​
API Endpoints
Method
Endpoint
Purpose
GET
/health
Check API and database health
GET
/api/agents
List financial agents
PATCH
/api/agents/:agentId/status
Change an agent's status
PATCH
/api/agents/:agentId/policy
Update an agent's policy
GET
/api/system/status
Get fleet emergency status
POST
/api/system/emergency-stop
Stop all financial agents
POST
/api/system/resume
Resume the system
POST
/api/actions/evaluate
Evaluate an agent action
GET
/api/approvals
List approval requests
PATCH
/api/approvals/:approvalId
Approve or reject a request
GET
/api/audit-events
List audit events
GET
/api/analytics/summary
Get governance analytics
Example Action Evaluation
Request:
curl -X POST <http://localhost:4000/api/actions/evaluate> \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "refund-agent",
    "action": "ISSUE_REFUND",
    "amount": 1000,
    "customerId": "CUSTOMER-1001"
  }'
​
Possible response:
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
​
Automated Testing
The Playwright test suite covers both the REST API and browser dashboard.
Coverage includes:
Backend health
Seeded agents
Allowed actions
Denied actions
Approval-required actions
Paused-agent enforcement
Emergency-stop enforcement
Dashboard loading
Policy editor
Human approval workflow
Fleet emergency controls
Run the full suite:
cd frontend
npm run test:e2e
​
Playwright starts isolated frontend and backend test servers and uses a separate SQLite database.
Continuous Integration
GitHub Actions runs the following checks on pushes and pull requests to main:
Install backend dependencies
Generate and validate Prisma
Check backend TypeScript
Install frontend dependencies
Lint and build the frontend
Install Chromium
Run Playwright API and browser tests
Upload failure reports and traces
Workflow file:
.github/workflows/ci.yml
​
Deployment
Backend on Railway
Recommended settings:
Root Directory: /backend
Build Command: npm ci --include=dev && npx prisma generate && npm run check
Start Command: npm run start:production
Health Check Path: /health
Volume Mount Path: /data
​
Railway environment variables:
DATABASE_URL=file:/data/agentguard.db
FRONTEND_ORIGIN=https://YOUR_VERCEL_DOMAIN
​
Do not set PORT manually. Railway provides it automatically.
After deployment, generate a Railway public domain and test:
curl https://YOUR_RAILWAY_DOMAIN/health
curl https://YOUR_RAILWAY_DOMAIN/api/agents
​
Frontend on Vercel
Recommended settings:
Root Directory: frontend
Framework Preset: Vite
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
​
Vercel environment variable:
VITE_API_BASE_URL=https://YOUR_RAILWAY_DOMAIN
​
After deployment, update Railway:
FRONTEND_ORIGIN=https://YOUR_VERCEL_DOMAIN
​
Do not include trailing slashes in either URL.
Environment Variables
Backend
Variable
Local example
Production purpose
PORT
4000
Express server port
FRONTEND_ORIGIN
http://localhost:5173
Allowed browser origin
DATABASE_URL
file:./prisma/dev.db
Prisma SQLite database path
Frontend
Variable
Local example
Production purpose
VITE_API_BASE_URL
http://localhost:4000
Backend API base URL
Never commit real .env files.
Troubleshooting
Railway cannot detect the application
Set the Railway service root directory to:
/backend
​
Railway should analyze backend/package.json, not the repository root.
Frontend displays Failed to fetch
Check:
VITE_API_BASE_URL contains the correct Railway URL
The Vercel project was redeployed after changing the variable
Railway is online
/health works publicly
Railway FRONTEND_ORIGIN exactly matches the Vercel production URL
Browser shows a CORS error
Set Railway:
FRONTEND_ORIGIN=https://YOUR_VERCEL_DOMAIN
​
Then deploy the pending Railway variable changes.
SQLite data disappears
Confirm:
A Railway volume is attached to the backend service
The volume mount path is /data
DATABASE_URL is file:/data/agentguard.db
Prisma migration fails
Run locally:
cd backend
npx prisma validate
npx prisma generate
npx prisma migrate deploy
​
Also confirm that all files under backend/prisma/migrations/ are committed.
Security Notes
Never commit .env files or database files.
Keep production URLs in deployment environment variables.
Restrict CORS to the deployed frontend domain.
Review approval and audit records before production use.
AgentGuard is a hackathon prototype and should be hardened before handling real financial transactions.
Future Improvements
Authentication and role-based access control
Multi-user approval workflows
PostgreSQL support
Configurable policy templates
Real-time notifications
Signed audit events
Exportable compliance reports
Policy versioning and rollback
Scheduled daily budget resets
Integration with real payment and card systems
Disclaimer
AgentGuard is a demonstration project. It is not production financial infrastructure and must not be used to process real financial transactions without additional security, compliance, reliability, and operational controls.
