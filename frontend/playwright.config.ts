import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",

  timeout: 30_000,

  expect: {
    timeout: 10_000,
  },

  fullyParallel: false,
  workers: 1,

  forbidOnly: Boolean(process.env.CI),

  retries: process.env.CI ? 2 : 0,

  reporter: [
    ["list"],

    [
      "html",
      {
        open: "never",
      },
    ],
  ],

  use: {
    baseURL: "http://localhost:5174",

    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",

      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  webServer: [
    {
      name: "AgentGuard backend",

      cwd: "../backend",

      command:
        "rm -f prisma/e2e.db prisma/e2e.db-journal prisma/e2e.db-shm prisma/e2e.db-wal && npx prisma migrate deploy && npx prisma db seed && npm run dev",

      url: "http://localhost:4100/health",

      timeout: 120_000,

      reuseExistingServer: false,

      env: {
        PORT: "4100",

        FRONTEND_ORIGIN: "http://localhost:5174",

        DATABASE_URL: "file:./prisma/e2e.db",
      },
    },

    {
      name: "AgentGuard frontend",

      command: "npm run dev -- --port 5174 --strictPort",

      url: "http://localhost:5174",

      timeout: 120_000,

      reuseExistingServer: false,

      env: {
        VITE_API_BASE_URL: "http://localhost:4100",
      },
    },
  ],
});
